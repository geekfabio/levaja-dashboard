import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providers, serviceRequests, zones } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { haversineKm } from "../lib/geo";
import { ACTIVE_REQUEST_STATUSES } from "../lib/request-state";
import { recordAdminAudit } from "../lib/admin-audit";
import { newId } from "../lib/ids";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ZoneRow = typeof zones.$inferSelect;

const LUANDA_LAT_RANGE = { min: -9.6, max: -8.3 };
const LUANDA_LNG_RANGE = { min: 12.9, max: 13.8 };

const zoneBodySchema = z.object({
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radius_km: z.number(),
  reason: z.string().optional(),
});

function present(zone: ZoneRow) {
  return {
    id: zone.id,
    name: zone.name,
    coords: { lat: Number(zone.lat), lng: Number(zone.lng) },
    radius_km: Number(zone.radiusKm),
  };
}

function describe(zone: { name: string; lat: number; lng: number; radiusKm: number }) {
  return `${zone.lat.toFixed(4)}; ${zone.lng.toFixed(4)} · ${zone.radiusKm.toFixed(1)} km`;
}

async function validateZoneInput(body: z.infer<typeof zoneBodySchema>, excludeId?: string) {
  const name = body.name.trim();
  if (name.length < 2) throw apiError("validation", "Indique o nome da zona.", { issues: [{ field: "name", message: "Indique o nome da zona." }] });

  const existing = await db.select().from(zones);
  if (existing.some((zone) => zone.id !== excludeId && zone.name.trim().toLowerCase() === name.toLowerCase())) {
    throw apiError("validation", "Já existe uma zona com este nome.", { issues: [{ field: "name", message: "Já existe uma zona com este nome." }] });
  }
  if (!Number.isFinite(body.latitude) || body.latitude < LUANDA_LAT_RANGE.min || body.latitude > LUANDA_LAT_RANGE.max) {
    throw apiError("validation", "A latitude tem de estar na área de Luanda.", { issues: [{ field: "latitude", message: "A latitude tem de estar na área de Luanda." }] });
  }
  if (!Number.isFinite(body.longitude) || body.longitude < LUANDA_LNG_RANGE.min || body.longitude > LUANDA_LNG_RANGE.max) {
    throw apiError("validation", "A longitude tem de estar na área de Luanda.", { issues: [{ field: "longitude", message: "A longitude tem de estar na área de Luanda." }] });
  }
  if (!Number.isFinite(body.radius_km) || body.radius_km < 0.5 || body.radius_km > 25) {
    throw apiError("validation", "O raio tem de estar entre 0,5 e 25 km.", { issues: [{ field: "radius_km", message: "O raio tem de estar entre 0,5 e 25 km." }] });
  }
  return { name, lat: body.latitude, lng: body.longitude, radiusKm: Math.round(body.radius_km * 10) / 10 };
}

export async function adminZoneRoutes(app: FastifyInstance) {
  app.get("/admin/zones", { preHandler: [authenticateAdmin] }, async () => {
    const zoneRows = await db.select().from(zones);
    const providerRows = await db.select().from(providers);
    const requestRows = await db.select().from(serviceRequests);
    const activeRequests = requestRows.filter((row) => (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(row.status));

    const items = zoneRows
      .map((zone) => {
        const center = { lat: Number(zone.lat), lng: Number(zone.lng) };
        const radiusKm = Number(zone.radiusKm);
        const providersCount = providerRows.filter((provider) => provider.coverageZoneIds.includes(zone.id)).length;
        const activeInZone = activeRequests.filter((row) => {
          const pickup = row.pickup as { lat?: number; lng?: number } | null;
          if (!pickup?.lat || !pickup?.lng) return false;
          return haversineKm(center, { lat: pickup.lat, lng: pickup.lng }) <= radiusKm;
        }).length;
        return { ...present(zone), providers_count: providersCount, active_requests: activeInZone };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));

    return dataEnvelope(items);
  });

  app.post("/admin/zones", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "zones.edit");
    const body = zoneBodySchema.parse(request.body);
    const reason = requireReason(body.reason);
    const input = await validateZoneInput(body);

    const id = newId("zn");
    await db.insert(zones).values({ id, name: input.name, lat: input.lat.toString(), lng: input.lng.toString(), radiusKm: input.radiusKm.toString() });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "zone.create",
      targetModule: "zone",
      targetId: id,
      targetLabel: input.name,
      reason,
      changes: [{ field: "Zona", from: "—", to: describe(input) }],
      sensitive: true,
    });

    const [zone] = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    return dataEnvelope(present(zone!));
  });

  app.patch("/admin/zones/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "zones.edit");
    const { id } = request.params as { id: string };
    const body = zoneBodySchema.parse(request.body);
    const reason = requireReason(body.reason);

    const [zone] = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    if (!zone) throw apiError("not_found", "Zona não encontrada.");

    const input = await validateZoneInput(body, id);
    const before = { name: zone.name, lat: Number(zone.lat), lng: Number(zone.lng), radiusKm: Number(zone.radiusKm) };

    const changes: { field: string; from: string; to: string }[] = [];
    if (before.name !== input.name) changes.push({ field: "Nome", from: before.name, to: input.name });
    if (describe(before) !== describe(input)) changes.push({ field: "Centro e raio", from: describe(before), to: describe(input) });
    if (!changes.length) throw apiError("validation", "Não há alterações para guardar.");

    await db
      .update(zones)
      .set({ name: input.name, lat: input.lat.toString(), lng: input.lng.toString(), radiusKm: input.radiusKm.toString() })
      .where(eq(zones.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "zone.update",
      targetModule: "zone",
      targetId: id,
      targetLabel: input.name,
      reason,
      changes,
      sensitive: true,
    });

    const [updated] = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    return dataEnvelope(present(updated!));
  });

  app.delete("/admin/zones/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "zones.edit");
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().optional() }).parse(request.body ?? {});
    const reason = requireReason(body.reason);

    const [zone] = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    if (!zone) throw apiError("not_found", "Zona não encontrada.");

    const providerRows = await db.select().from(providers);
    const providersCount = providerRows.filter((provider) => provider.coverageZoneIds.includes(id)).length;
    const center = { lat: Number(zone.lat), lng: Number(zone.lng) };
    const radiusKm = Number(zone.radiusKm);
    const requestRows = await db.select().from(serviceRequests);
    const activeCount = requestRows.filter((row) => {
      if (!(ACTIVE_REQUEST_STATUSES as readonly string[]).includes(row.status)) return false;
      const pickup = row.pickup as { lat?: number; lng?: number } | null;
      if (!pickup?.lat || !pickup?.lng) return false;
      return haversineKm(center, { lat: pickup.lat, lng: pickup.lng }) <= radiusKm;
    }).length;
    if (providersCount > 0 || activeCount > 0) {
      throw apiError("validation", `Não é possível remover «${zone.name}»: tem ${providersCount} prestador(es) e ${activeCount} pedido(s) activo(s).`);
    }

    await db.delete(zones).where(eq(zones.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "zone.delete",
      targetModule: "zone",
      targetId: id,
      targetLabel: zone.name,
      reason,
      changes: [{ field: "Zona", from: describe({ name: zone.name, lat: Number(zone.lat), lng: Number(zone.lng), radiusKm: Number(zone.radiusKm) }), to: "Removida" }],
      sensitive: true,
    });

    return dataEnvelope(null);
  });
}
