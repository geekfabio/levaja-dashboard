import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { platformSettings } from "../db/schema/admin";
import { providers, serviceRequestEvents, serviceRequests, serviceTypeEnum, zones } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { addDays, daysBetween, dispatchStartsAt, luandaDay, luandaHour, nearestZoneId, scheduleRisk, slaStats } from "../lib/dispatch";
import { dataEnvelope } from "../lib/envelope";
import { requirePermission } from "../lib/require-permission";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;
type ZoneRow = typeof zones.$inferSelect;

const SETTINGS_KEY = "settings";
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;

const SERVICE_KINDS = serviceTypeEnum.enumValues;

type DispatchSettings = { schedule_lead_minutes: number; assign_target_minutes: number; arrival_target_minutes: number };

const DEFAULT_DISPATCH: DispatchSettings = { schedule_lead_minutes: 60, assign_target_minutes: 8, arrival_target_minutes: 30 };

async function loadDispatchSettings(): Promise<DispatchSettings> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
  const value = row?.value as { dispatch?: Partial<DispatchSettings> } | undefined;
  return { ...DEFAULT_DISPATCH, ...(value?.dispatch ?? {}) };
}

function pickupPoint(row: ServiceRequestRow): { lat: number; lng: number } | null {
  const pickup = row.pickup as { lat?: number; lng?: number } | null;
  if (!pickup || typeof pickup.lat !== "number" || typeof pickup.lng !== "number") return null;
  return { lat: pickup.lat, lng: pickup.lng };
}

function presentZones(zoneRows: ZoneRow[]) {
  return zoneRows.map((zone) => ({ id: zone.id, name: zone.name, lat: Number(zone.lat), lng: Number(zone.lng), radiusKm: Number(zone.radiusKm) }));
}

function zoneIdFor(row: ServiceRequestRow, zoneRows: { id: string; lat: number; lng: number; radiusKm: number }[]) {
  const point = pickupPoint(row);
  return point ? nearestZoneId(point, zoneRows) : null;
}

function presentRequest(row: ServiceRequestRow, zoneName: string | null, risk: boolean) {
  return {
    id: row.id,
    code: row.code,
    service_type: row.serviceType,
    status: row.status,
    client_id: row.clientAccountId,
    provider_id: row.providerAccountId,
    pickup: row.pickup,
    scheduled_for: row.scheduledFor ? row.scheduledFor.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    zone_name: zoneName,
    risk,
  };
}

const scheduledQuerySchema = z.object({
  state: z.enum(["unassigned", "assigned", "risk", "all"]).optional(),
  days: z.coerce.number().int().positive().optional(),
  zone: z.string().optional(),
});

const slaQuerySchema = z.object({ from: z.string(), to: z.string() });

const heatmapQuerySchema = z.object({
  kind: z.enum(["demand", "supply"]),
  days: z.coerce.number().int().positive(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

export async function adminOperationsRoutes(app: FastifyInstance) {
  app.get("/admin/operations/scheduled", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.view");
    const query = scheduledQuerySchema.parse(request.query);
    const zoneFilter = query.zone ? query.zone.split(",").map((value) => value.trim()).filter(Boolean) : undefined;

    const zoneRows = presentZones(await db.select().from(zones));
    const zoneName = new Map(zoneRows.map((zone) => [zone.id, zone.name]));

    const nowMs = Date.now();
    const days = query.days ?? 14;
    const horizon = nowMs + days * DAY_MS;

    const rows = await db.select().from(serviceRequests);
    const upcoming = rows
      .filter((row) => row.scheduledFor && (row.status === "searching" || row.status === "assigned"))
      .filter((row) => row.scheduledFor!.getTime() >= nowMs - 2 * 3_600_000 && row.scheduledFor!.getTime() <= horizon)
      .map((row) => ({ row, zoneId: zoneIdFor(row, zoneRows) }))
      .filter((item) => !zoneFilter?.length || (item.zoneId && zoneFilter.includes(item.zoneId)))
      .sort((a, b) => a.row.scheduledFor!.getTime() - b.row.scheduledFor!.getTime());

    const items = upcoming.filter((item) => {
      if (query.state === "unassigned") return !item.row.providerAccountId;
      if (query.state === "assigned") return Boolean(item.row.providerAccountId);
      if (query.state === "risk") return scheduleRisk(item.row, nowMs);
      return true;
    });

    const today = luandaDay(new Date(nowMs));
    const weekEnd = addDays(today, 6);

    return dataEnvelope({
      items: items.map((item) => presentRequest(item.row, item.zoneId ? zoneName.get(item.zoneId) ?? null : null, scheduleRisk(item.row, nowMs))),
      totals: {
        today: upcoming.filter((item) => luandaDay(item.row.scheduledFor!) === today).length,
        next7: upcoming.filter((item) => luandaDay(item.row.scheduledFor!) <= weekEnd).length,
        unassigned: upcoming.filter((item) => !item.row.providerAccountId).length,
        risk: upcoming.filter((item) => scheduleRisk(item.row, nowMs)).length,
      },
    });
  });

  app.get("/admin/operations/sla", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.view");
    const query = slaQuerySchema.parse(request.query);
    const from = query.from.slice(0, 10);
    const to = query.to.slice(0, 10);

    const dispatch = await loadDispatchSettings();
    const targets = { assign: dispatch.assign_target_minutes, arrival: dispatch.arrival_target_minutes };
    const zoneRows = presentZones(await db.select().from(zones));
    const zoneName = new Map(zoneRows.map((zone) => [zone.id, zone.name]));

    const fromMs = new Date(`${from}T00:00:00Z`).getTime();
    const toMs = new Date(`${to}T23:59:59.999Z`).getTime();
    const rows = (await db.select().from(serviceRequests)).filter((row) => row.createdAt.getTime() >= fromMs && row.createdAt.getTime() <= toMs);

    const requestIds = rows.map((row) => row.id);
    const events = requestIds.length ? await db.select().from(serviceRequestEvents).where(inArray(serviceRequestEvents.requestId, requestIds)) : [];
    const eventAt = (requestId: string, status: "assigned" | "arrived") => {
      const match = events.filter((event) => event.requestId === requestId && event.status === status).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
      return match?.at;
    };

    type Timing = { row: ServiceRequestRow; zoneId: string | null; assign?: number; arrival?: number };
    const items: Timing[] = rows.map((row) => {
      const assignedAt = eventAt(row.id, "assigned");
      const arrivedAt = eventAt(row.id, "arrived");
      return {
        row,
        zoneId: zoneIdFor(row, zoneRows),
        assign: assignedAt ? Math.max(0, Math.round((assignedAt.getTime() - dispatchStartsAt(row, dispatch.schedule_lead_minutes)) / MINUTE_MS)) : undefined,
        arrival: assignedAt && arrivedAt ? Math.max(0, Math.round((arrivedAt.getTime() - assignedAt.getTime()) / MINUTE_MS)) : undefined,
      };
    });

    const statsOf = (subset: Timing[]) => ({
      assign: slaStats(subset.flatMap((item) => (item.assign === undefined ? [] : [item.assign])), targets.assign),
      arrival: slaStats(subset.flatMap((item) => (item.arrival === undefined ? [] : [item.arrival])), targets.arrival),
    });

    const breaches = items
      .flatMap((item) => {
        const base = { request_id: item.row.id, code: item.row.code, kind: item.row.serviceType, zone_name: item.zoneId ? zoneName.get(item.zoneId) ?? "—" : "—", at: item.row.createdAt.toISOString() };
        const list: { request_id: string; code: string; kind: string; zone_name: string; at: string; metric: "assign" | "arrival"; minutes: number; target: number }[] = [];
        if (item.assign !== undefined && item.assign > targets.assign) list.push({ ...base, metric: "assign", minutes: item.assign, target: targets.assign });
        if (item.arrival !== undefined && item.arrival > targets.arrival) list.push({ ...base, metric: "arrival", minutes: item.arrival, target: targets.arrival });
        return list;
      })
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 40);

    return dataEnvelope({
      from,
      to,
      targets: { assign: targets.assign, arrival: targets.arrival },
      ...statsOf(items),
      by_zone: zoneRows.map((zone) => ({ zone_id: zone.id, zone_name: zone.name, ...statsOf(items.filter((item) => item.zoneId === zone.id)) })),
      by_service: SERVICE_KINDS.map((kind) => ({ kind, ...statsOf(items.filter((item) => item.row.serviceType === kind)) })),
      daily: daysBetween(from, to).map((date) => {
        const day = items.filter((item) => luandaDay(item.row.createdAt) === date);
        const stats = statsOf(day);
        return { date, assign_within: stats.assign.withinRate, arrival_within: stats.arrival.withinRate, count: day.length };
      }),
      breaches,
    });
  });

  app.get("/admin/operations/heatmap", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.view");
    const query = heatmapQuerySchema.parse(request.query);

    const zoneRows = presentZones(await db.select().from(zones));
    const sinceMs = Date.now() - query.days * DAY_MS;
    const hourMatches = (date: Date) => query.hour === undefined || luandaHour(date) === query.hour;

    const demandRows = (await db.select().from(serviceRequests)).filter((row) => row.createdAt.getTime() >= sinceMs && hourMatches(row.createdAt));
    const activeProviders = (await db.select().from(providers)).filter((provider) => provider.accountStatus === "active");
    const onlineProviders = activeProviders.filter((provider) => provider.online);

    const grid = new Map<string, { latitude: number; longitude: number; weight: number }>();
    const add = (lat: number, lng: number) => {
      const key = `${Math.round(lat * 100)}:${Math.round(lng * 100)}`;
      const cell = grid.get(key) ?? { latitude: Math.round(lat * 100) / 100, longitude: Math.round(lng * 100) / 100, weight: 0 };
      cell.weight += 1;
      grid.set(key, cell);
    };

    if (query.kind === "demand") {
      for (const row of demandRows) {
        const point = pickupPoint(row);
        if (point) add(point.lat, point.lng);
      }
    } else {
      for (const provider of onlineProviders) {
        if (provider.lat !== null && provider.lng !== null) add(Number(provider.lat), Number(provider.lng));
      }
    }

    const points = [...grid.values()];
    const demandZoneId = (row: ServiceRequestRow) => zoneIdFor(row, zoneRows);

    const zoneReport = zoneRows
      .map((zone) => {
        const demand = demandRows.filter((row) => demandZoneId(row) === zone.id).length;
        const supply = activeProviders.filter((provider) => provider.coverageZoneIds.includes(zone.id)).length;
        return { zone_id: zone.id, zone_name: zone.name, demand, supply, ratio: supply ? Math.round((demand / supply) * 10) / 10 : null };
      })
      .sort((a, b) => (b.ratio ?? Infinity) - (a.ratio ?? Infinity));

    return dataEnvelope({
      points,
      max: points.reduce((max, point) => Math.max(max, point.weight), 0),
      zones: zoneReport,
    });
  });
}
