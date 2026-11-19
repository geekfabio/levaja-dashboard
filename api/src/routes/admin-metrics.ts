import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { inArray } from "drizzle-orm";
import { providers, serviceRequestEvents, serviceRequests } from "../db/schema/ops";
import { daysBetween, luandaDay } from "../lib/dispatch";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { requirePermission } from "../lib/require-permission";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const SETTLED_STATUSES = ["paid", "rated"] as const;
const IN_PROGRESS_STATUSES = ["searching", "assigned", "en_route", "arrived", "pickup_confirmed", "in_transit"] as const;
const COMPLETED_STATUSES = ["delivered", "paid", "rated"] as const;
const SERVICE_KINDS = ["tow", "cargo", "small_move", "house_move"] as const;

const rangeQuerySchema = z.object({ from: z.string(), to: z.string() });

const FUNNEL_STATUSES = ["searching", "assigned", "en_route", "arrived", "pickup_confirmed", "in_transit", "delivered", "paid", "rated"] as const;
const MAX_DAILY_POINTS = 92;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A bare date means the whole day in Luanda (UTC+1), so "to" includes that day's requests. */
function rangeBounds(from: string, to: string) {
  const start = new Date(DATE_ONLY.test(from) ? `${from}T00:00:00+01:00` : from);
  const end = new Date(DATE_ONLY.test(to) ? `${to}T23:59:59.999+01:00` : to);
  return { start, end };
}

type EventTimes = Map<string, Map<string, Date>>;

async function loadEventTimes(requestIds: string[]): Promise<EventTimes> {
  const times: EventTimes = new Map();
  if (requestIds.length === 0) return times;
  const events = await db.select().from(serviceRequestEvents).where(inArray(serviceRequestEvents.requestId, requestIds));
  for (const event of events) {
    const own = times.get(event.requestId) ?? new Map<string, Date>();
    const known = own.get(event.status);
    if (!known || event.at < known) own.set(event.status, event.at);
    times.set(event.requestId, own);
  }
  return times;
}

function averageAssignMinutes(rows: ServiceRequestRow[], times: EventTimes) {
  const spans = rows.flatMap((row) => {
    const own = times.get(row.id);
    const searching = own?.get("searching") ?? row.createdAt;
    const assigned = own?.get("assigned");
    return assigned ? [(assigned.getTime() - searching.getTime()) / 60_000] : [];
  });
  return spans.length ? Math.round((spans.reduce((sum, value) => sum + value, 0) / spans.length) * 10) / 10 : null;
}

function pricingTotal(row: ServiceRequestRow) {
  const pricing = row.pricing as { total_kz?: number; platform_fee_kz?: number } | null;
  return pricing?.total_kz ?? 0;
}

function pricingFee(row: ServiceRequestRow) {
  const pricing = row.pricing as { platform_fee_kz?: number } | null;
  return pricing?.platform_fee_kz ?? 0;
}

function commissionOf(row: ServiceRequestRow) {
  if (row.providerEarningKz === null) return 0;
  return Math.max(0, pricingTotal(row) - pricingFee(row) - row.providerEarningKz);
}

function isSettled(row: ServiceRequestRow) {
  return (SETTLED_STATUSES as readonly string[]).includes(row.status);
}

function kpisFor(rows: ServiceRequestRow[], onlineProviders: number, avgAssignMinutes: number | null) {
  const settled = rows.filter(isSettled);
  const fees = settled.reduce((sum, row) => sum + pricingFee(row), 0);
  const commissions = settled.reduce((sum, row) => sum + commissionOf(row), 0);
  const ratings = rows.map((row) => row.rating).filter((value): value is number => value !== null);

  return {
    requests: rows.length,
    in_progress: rows.filter((row) => (IN_PROGRESS_STATUSES as readonly string[]).includes(row.status)).length,
    completed: rows.filter((row) => (COMPLETED_STATUSES as readonly string[]).includes(row.status)).length,
    cancelled: rows.filter((row) => row.status === "cancelled").length,
    platform_revenue_kz: fees + commissions,
    fees_kz: fees,
    commissions_kz: commissions,
    volume_kz: settled.reduce((sum, row) => sum + pricingTotal(row), 0),
    avg_assign_minutes: avgAssignMinutes,
    providers_online: onlineProviders,
    average_rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
  };
}

export async function adminMetricsRoutes(app: FastifyInstance) {
  app.get("/admin/metrics", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "metrics.view");
    const query = rangeQuerySchema.parse(request.query);

    const { start: from, end: to } = rangeBounds(query.from, query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw apiError("validation", "Intervalo de datas inválido.");
    }
    const spanMs = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - spanMs - 1);
    const previousTo = new Date(from.getTime() - 1);

    const rows = await db.select().from(serviceRequests);
    const current = rows.filter((row) => row.createdAt >= from && row.createdAt <= to);
    const previous = rows.filter((row) => row.createdAt >= previousFrom && row.createdAt <= previousTo);

    const providerRows = await db.select().from(providers);
    const onlineProviders = providerRows.filter((provider) => provider.online && provider.accountStatus === "active").length;

    const byService = SERVICE_KINDS.map((kind) => {
      const own = current.filter((row) => row.serviceType === kind);
      return { kind, count: own.length, volume_kz: own.filter(isSettled).reduce((sum, row) => sum + pricingTotal(row), 0) };
    });

    const times = await loadEventTimes([...current, ...previous].map((row) => row.id));

    const days = daysBetween(luandaDay(from), luandaDay(to)).slice(-MAX_DAILY_POINTS);
    const daily = days.map((date) => ({ date, total: 0, completed: 0, cancelled: 0, revenue_kz: 0 }));
    const byDate = new Map(daily.map((point) => [point.date, point]));
    for (const row of current) {
      const point = byDate.get(luandaDay(row.createdAt));
      if (!point) continue;
      point.total += 1;
      if ((COMPLETED_STATUSES as readonly string[]).includes(row.status)) point.completed += 1;
      if (row.status === "cancelled") point.cancelled += 1;
      if (isSettled(row)) point.revenue_kz += pricingFee(row) + commissionOf(row);
    }

    const funnel = FUNNEL_STATUSES.map((status) => ({ status, count: current.filter((row) => times.get(row.id)?.has(status) || (status === "searching" && !times.has(row.id))).length }));

    return dataEnvelope({
      from: query.from,
      to: query.to,
      kpis: kpisFor(current, onlineProviders, averageAssignMinutes(current, times)),
      previous: kpisFor(previous, onlineProviders, averageAssignMinutes(previous, times)),
      by_service: byService,
      daily,
      funnel,
    });
  });
}
