import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providers, serviceRequests } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { requirePermission } from "../lib/require-permission";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const SETTLED_STATUSES = ["paid", "rated"] as const;
const IN_PROGRESS_STATUSES = ["searching", "assigned", "en_route", "arrived", "pickup_confirmed", "in_transit"] as const;
const COMPLETED_STATUSES = ["delivered", "paid", "rated"] as const;
const SERVICE_KINDS = ["tow", "cargo", "small_move", "house_move"] as const;

const rangeQuerySchema = z.object({ from: z.string(), to: z.string() });

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

function kpisFor(rows: ServiceRequestRow[], onlineProviders: number) {
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
    providers_online: onlineProviders,
    average_rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
  };
}

export async function adminMetricsRoutes(app: FastifyInstance) {
  app.get("/admin/metrics", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "metrics.view");
    const query = rangeQuerySchema.parse(request.query);

    const from = new Date(query.from);
    const to = new Date(query.to);
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

    return dataEnvelope({
      from: query.from,
      to: query.to,
      kpis: kpisFor(current, onlineProviders),
      previous: kpisFor(previous, onlineProviders),
      by_service: byService,
    });
  });
}
