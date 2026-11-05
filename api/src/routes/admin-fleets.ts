import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { fleets, providers, serviceRequests } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { listPageEnvelope, pageQuerySchema, csvList, paginate } from "../lib/pagination";
import { formatAngolaPhone } from "../lib/phone";
import { loadProviderAccounts, presentProvider } from "../lib/provider-presenter";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type FleetRow = typeof fleets.$inferSelect;

const FLEET_STATUS_LABELS: Record<FleetRow["status"], string> = { active: "Activa", suspended: "Suspensa" };

const DAY_MS = 86_400_000;

const listQuerySchema = pageQuerySchema.extend({ status: z.string().optional(), q: z.string().optional() });

const createBodySchema = z.object({
  name: z.string().optional().default(""),
  nif: z.string().optional().default(""),
  contact_name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

const addDriverBodySchema = z.object({ provider_id: z.string() });
const reasonBodySchema = z.object({ reason: z.string().optional() });
const statusBodySchema = z.object({ status: z.enum(["active", "suspended"]), reason: z.string().optional() });

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function loadFleetOrNotFound(id: string) {
  const [fleet] = await db.select().from(fleets).where(eq(fleets.id, id)).limit(1);
  if (!fleet) throw apiError("not_found", "Frota não encontrada.");
  return fleet;
}

async function fleetStats(fleet: FleetRow) {
  const drivers = await db.select().from(providers).where(eq(providers.fleetId, fleet.id));
  const ids = drivers.map((driver) => driver.accountId);
  const since = new Date(Date.now() - 30 * DAY_MS);

  let completed30 = 0;
  let volume30 = 0;
  const ratings: number[] = [];
  if (ids.length > 0) {
    const own = await db.select().from(serviceRequests);
    for (const request of own) {
      if (!request.providerAccountId || !ids.includes(request.providerAccountId)) continue;
      if (request.status !== "paid" && request.status !== "rated") continue;
      if (request.createdAt < since) continue;
      completed30 += 1;
      const pricing = request.pricing as { total_kz?: number } | null;
      volume30 += pricing?.total_kz ?? 0;
      if (request.rating !== null) ratings.push(request.rating);
    }
  }

  return {
    drivers: drivers.length,
    online: drivers.filter((driver) => driver.online).length,
    completed30,
    volume30,
    rating: ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null,
  };
}

async function presentFleetSummary(fleet: FleetRow) {
  return {
    id: fleet.id,
    name: fleet.name,
    nif: fleet.nif,
    contact_name: fleet.contactName,
    phone: fleet.phone,
    email: fleet.email,
    status: fleet.status,
    suspension_reason: fleet.suspensionReason,
    created_at: fleet.createdAt.toISOString(),
    stats: await fleetStats(fleet),
  };
}

async function presentFleetDetail(fleet: FleetRow) {
  const summary = await presentFleetSummary(fleet);
  const driverRows = await db.select().from(providers).where(eq(providers.fleetId, fleet.id));
  const accountsById = await loadProviderAccounts(driverRows.map((driver) => driver.accountId));
  const drivers = await Promise.all(
    driverRows.map(async (driver) => {
      const account = accountsById.get(driver.accountId);
      if (!account) return null;
      return presentProvider(account, driver);
    }),
  );
  return { ...summary, drivers: drivers.filter((driver) => driver !== null) };
}

export async function adminFleetRoutes(app: FastifyInstance) {
  app.get("/admin/fleets", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "fleets.view");
    const query = listQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status);

    const rows = await db.select().from(fleets);
    const filtered = rows
      .filter((fleet) => (!statusFilter?.length || statusFilter.includes(fleet.status)) && matchesText(query.q, fleet.name, fleet.nif, fleet.contactName))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const presented = await Promise.all(filtered.map((fleet) => presentFleetSummary(fleet)));
    return listPageEnvelope(paginate(presented, query));
  });

  app.get("/admin/fleets/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "fleets.view");
    const { id } = request.params as { id: string };
    const fleet = await loadFleetOrNotFound(id);
    return dataEnvelope(await presentFleetDetail(fleet));
  });

  app.post("/admin/fleets", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "fleets.manage");
    const body = createBodySchema.parse(request.body);

    const name = body.name.trim();
    const nif = body.nif.trim();
    const contactName = body.contact_name.trim();
    const email = body.email.trim();
    let formattedPhone: string | undefined;
    try {
      formattedPhone = formatAngolaPhone(body.phone);
    } catch {
      formattedPhone = undefined;
    }

    const issues: { field: string; message: string }[] = [];
    if (name.length < 2) issues.push({ field: "name", message: "Indique o nome da frota." });
    if (!/^\d{9,14}$/.test(nif)) issues.push({ field: "nif", message: "O NIF tem entre 9 e 14 dígitos." });
    if (contactName.length < 2) issues.push({ field: "contact_name", message: "Indique o responsável." });
    if (!formattedPhone) issues.push({ field: "phone", message: "Indique um telefone de Angola (+244 9XX XXX XXX)." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ field: "email", message: "Indique um e-mail válido." });
    if (issues.length > 0) throw apiError("validation", issues[0]!.message, { issues });

    const [existing] = await db.select().from(fleets).where(eq(fleets.nif, nif)).limit(1);
    if (existing) {
      throw apiError("validation", "Já existe uma frota com este NIF.", { issues: [{ field: "nif", message: "NIF já registado." }] });
    }

    const fleet: FleetRow = {
      id: newId("flt"),
      name,
      nif,
      contactName,
      phone: formattedPhone!,
      email: email.toLowerCase(),
      status: "active",
      suspensionReason: null,
      createdAt: new Date(),
    };
    await db.insert(fleets).values(fleet);
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "fleet.create",
      targetModule: "fleet",
      targetId: fleet.id,
      targetLabel: fleet.name,
      reason: `NIF ${fleet.nif}`,
    });

    return dataEnvelope(await presentFleetSummary(fleet));
  });

  app.post("/admin/fleets/:id/drivers", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "fleets.manage");
    const { id } = request.params as { id: string };
    const fleet = await loadFleetOrNotFound(id);
    if (fleet.status !== "active") {
      throw apiError("invalid_transition", "Não é possível acrescentar motoristas a uma frota suspensa.");
    }
    const body = addDriverBodySchema.parse(request.body);

    const [provider] = await db.select().from(providers).where(eq(providers.accountId, body.provider_id)).limit(1);
    if (!provider) throw apiError("not_found", "Prestador não encontrado.");
    if (provider.fleetId === fleet.id) throw apiError("validation", "O prestador já pertence a esta frota.");
    if (provider.fleetId) {
      const [other] = await db.select().from(fleets).where(eq(fleets.id, provider.fleetId)).limit(1);
      throw apiError("validation", `O prestador já pertence à frota ${other?.name ?? "outra frota"}.`);
    }

    await db.update(providers).set({ fleetId: fleet.id }).where(eq(providers.accountId, body.provider_id));
    const [account] = await db.select().from(accounts).where(eq(accounts.id, body.provider_id)).limit(1);
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "fleet.driver_add",
      targetModule: "fleet",
      targetId: fleet.id,
      targetLabel: fleet.name,
      changes: [{ field: "Motorista", from: "—", to: account?.fullName ?? body.provider_id }],
    });

    return dataEnvelope(await presentFleetDetail(fleet));
  });

  app.post("/admin/fleets/:id/drivers/:providerId/remove", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "fleets.manage");
    const { id, providerId } = request.params as { id: string; providerId: string };
    const fleet = await loadFleetOrNotFound(id);
    const [provider] = await db.select().from(providers).where(eq(providers.accountId, providerId)).limit(1);
    if (!provider) throw apiError("not_found", "Prestador não encontrado.");
    if (provider.fleetId !== fleet.id) throw apiError("validation", "O prestador não pertence a esta frota.");

    const body = reasonBodySchema.parse(request.body);
    const why = requireReason(body.reason, "o motivo");

    await db.update(providers).set({ fleetId: null }).where(eq(providers.accountId, providerId));
    const [account] = await db.select().from(accounts).where(eq(accounts.id, providerId)).limit(1);
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "fleet.driver_remove",
      targetModule: "fleet",
      targetId: fleet.id,
      targetLabel: fleet.name,
      reason: why,
      changes: [{ field: "Motorista", from: account?.fullName ?? providerId, to: "—" }],
    });

    return dataEnvelope(await presentFleetDetail(fleet));
  });

  app.post("/admin/fleets/:id/status", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "fleets.manage");
    const { id } = request.params as { id: string };
    const fleet = await loadFleetOrNotFound(id);
    const body = statusBodySchema.parse(request.body);

    if (fleet.status === body.status) {
      throw apiError("invalid_transition", `A frota já está ${FLEET_STATUS_LABELS[body.status].toLowerCase()}.`);
    }
    const why = requireReason(body.reason, "o motivo");
    const from = FLEET_STATUS_LABELS[fleet.status];

    await db
      .update(fleets)
      .set({ status: body.status, suspensionReason: body.status === "suspended" ? why : null })
      .where(eq(fleets.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: body.status === "suspended" ? "fleet.suspend" : "fleet.reactivate",
      targetModule: "fleet",
      targetId: fleet.id,
      targetLabel: fleet.name,
      reason: why,
      changes: [{ field: "Estado", from, to: FLEET_STATUS_LABELS[body.status] }],
      sensitive: true,
    });

    const updated = await loadFleetOrNotFound(id);
    return dataEnvelope(await presentFleetSummary(updated));
  });
}
