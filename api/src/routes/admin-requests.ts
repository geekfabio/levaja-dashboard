import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providers, serviceRequestEvents, serviceRequests, zones } from "../db/schema/ops";
import { disputes } from "../db/schema/disputes";
import { platformSettings } from "../db/schema/admin";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { haversineKm } from "../lib/geo";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { documentsVerified } from "../lib/provider-documents";
import { loadProviderAccounts, presentProvider } from "../lib/provider-presenter";
import { presentServiceRequest } from "../lib/request-presenter";
import {
  ACTIVE_REQUEST_STATUSES,
  PROVIDER_BUSY_STATUSES,
  canOpenDispute,
  isCancellable,
  isForceCompletable,
  isReassignable,
  stepsUntil,
} from "../lib/request-state";
import type { ServiceRequestStatus } from "../lib/request-state";
import { creditEarning } from "../lib/wallet";
import { recordAdminAudit } from "../lib/admin-audit";
import { newId } from "../lib/ids";
import { DISPUTE_CATEGORIES } from "./admin-disputes";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;
type ProviderRow = typeof providers.$inferSelect;

const DEFAULT_MAX_RADIUS_KM = 15;

type EligibilityIssue = "offline" | "not_active" | "documents" | "service" | "zone" | "far";

type PickupPoint = { lat: number; lng: number };

function pickupPoint(row: ServiceRequestRow): PickupPoint | null {
  const pickup = row.pickup as { lat?: number; lng?: number } | null;
  if (!pickup || typeof pickup.lat !== "number" || typeof pickup.lng !== "number") return null;
  return { lat: pickup.lat, lng: pickup.lng };
}

async function maxDispatchRadiusKm() {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, "settings")).limit(1);
  const value = row?.value as { dispatch?: { max_radius_km?: number } } | undefined;
  return value?.dispatch?.max_radius_km ?? DEFAULT_MAX_RADIUS_KM;
}

async function zoneIdsCovering(point: PickupPoint) {
  const zoneRows = await db.select().from(zones);
  return zoneRows
    .filter((zone) => haversineKm({ lat: Number(zone.lat), lng: Number(zone.lng) }, point) <= Number(zone.radiusKm))
    .map((zone) => zone.id);
}

async function providerBusyWithOtherRequest(providerAccountId: string, excludeRequestId: string) {
  const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, providerAccountId));
  return rows.some((row) => row.id !== excludeRequestId && (PROVIDER_BUSY_STATUSES as readonly string[]).includes(row.status));
}

async function reassignEligibilityIssues(
  provider: ProviderRow,
  request: ServiceRequestRow,
  pickup: PickupPoint | null,
  zoneIds: string[],
  maxRadiusKm: number,
): Promise<{ issues: EligibilityIssue[]; distanceKm: number | null }> {
  const issues: EligibilityIssue[] = [];
  if (!provider.online) issues.push("offline");
  if (provider.accountStatus !== "active") issues.push("not_active");
  if (!(await documentsVerified(provider.accountId))) issues.push("documents");
  if (!provider.coverageServiceTypes.includes(request.serviceType)) issues.push("service");
  if (zoneIds.length > 0 && !zoneIds.some((id) => provider.coverageZoneIds.includes(id))) issues.push("zone");

  let distanceKm: number | null = null;
  if (provider.lat !== null && provider.lng !== null && pickup) {
    distanceKm = Math.round(haversineKm({ lat: Number(provider.lat), lng: Number(provider.lng) }, pickup) * 10) / 10;
    if (distanceKm > maxRadiusKm) issues.push("far");
  } else {
    issues.push("far");
  }

  return { issues, distanceKm };
}

const REQUEST_STATUS_VALUES = [
  "searching",
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
  "rated",
  "cancelled",
] as const satisfies readonly ServiceRequestStatus[];

const listQuerySchema = pageQuerySchema.extend({
  status: z.string().optional(),
  service_type: z.string().optional(),
  payment_method: z.string().optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const cancelBodySchema = z.object({ reason: z.string().optional() });
const reassignBodySchema = z.object({ provider_id: z.string(), reason: z.string().optional() });
const disputeBodySchema = z.object({ reason: z.string().optional(), category: z.enum(DISPUTE_CATEGORIES).optional() });
const forceCompleteBodySchema = z.object({ reason: z.string().optional() });

function csv(value: string | undefined) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function loadRequestOrNotFound(id: string): Promise<ServiceRequestRow> {
  const [row] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Pedido não encontrado.");
  return row;
}

export async function adminRequestRoutes(app: FastifyInstance) {
  app.get("/admin/requests", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.view");
    const query = listQuerySchema.parse(request.query);

    const statusFilter = csv(query.status);
    if (statusFilter && !statusFilter.every((value) => (REQUEST_STATUS_VALUES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de pedido inválido.");
    }
    const serviceFilter = csv(query.service_type);
    const paymentFilter = csv(query.payment_method);

    const rows = await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
    const filteredRows = rows.filter((row) => {
      if (statusFilter?.length && !statusFilter.includes(row.status)) return false;
      if (serviceFilter?.length && !serviceFilter.includes(row.serviceType)) return false;
      if (paymentFilter?.length && (!row.paymentMethod || !paymentFilter.includes(row.paymentMethod))) return false;
      if (query.from && row.createdAt.toISOString() < query.from) return false;
      if (query.to && row.createdAt.toISOString() > query.to) return false;
      return true;
    });

    const presented = await Promise.all(filteredRows.map(presentServiceRequest));
    const matched = presented.filter((item) =>
      matchesText(query.q, item.code, item.client?.full_name, item.client?.phone, item.provider?.full_name, item.provider?.vehicle?.plate),
    );

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/requests/active", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.view");
    const rows = await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
    const active = rows.filter((row) => (ACTIVE_REQUEST_STATUSES as readonly string[]).includes(row.status));
    return dataEnvelope(await Promise.all(active.map(presentServiceRequest)));
  });

  app.get("/admin/requests/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.view");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    return dataEnvelope(await presentServiceRequest(row));
  });

  app.post("/admin/requests/:id/cancel", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.operate");
    const { id } = request.params as { id: string };
    const body = cancelBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo do cancelamento");

    const row = await loadRequestOrNotFound(id);
    if (!isCancellable(row.status)) {
      throw apiError("invalid_transition", `Não é possível cancelar um pedido em «${row.status}».`);
    }

    const now = new Date();
    await db
      .update(serviceRequests)
      .set({ status: "cancelled", cancelReason: reason, updatedAt: now })
      .where(eq(serviceRequests.id, id));
    await db.insert(serviceRequestEvents).values({ id: newId("evt"), requestId: id, status: "cancelled", actor: "system", at: now });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "request.cancel",
      targetModule: "request",
      targetId: row.id,
      targetLabel: row.code,
      reason,
      changes: [{ field: "Estado", from: row.status, to: "cancelled" }],
      sensitive: true,
    });

    return dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id)));
  });

  app.get("/admin/requests/:id/reassign-candidates", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.operate");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);

    const pickup = pickupPoint(row);
    const [zoneIds, maxRadiusKm, providerRows] = await Promise.all([
      pickup ? zoneIdsCovering(pickup) : Promise.resolve<string[]>([]),
      maxDispatchRadiusKm(),
      db.select().from(providers),
    ]);

    const candidateRows = providerRows.filter(
      (provider) => provider.accountId !== row.providerAccountId && provider.coverageServiceTypes.includes(row.serviceType),
    );
    const notBusy = (
      await Promise.all(
        candidateRows.map(async (provider) => ((await providerBusyWithOtherRequest(provider.accountId, row.id)) ? null : provider)),
      )
    ).filter((provider): provider is ProviderRow => provider !== null);

    const accountsById = await loadProviderAccounts(notBusy.map((provider) => provider.accountId));
    const candidates = await Promise.all(
      notBusy.map(async (provider) => {
        const account = accountsById.get(provider.accountId);
        if (!account) return null;
        const { issues, distanceKm } = await reassignEligibilityIssues(provider, row, pickup, zoneIds, maxRadiusKm);
        return { provider: await presentProvider(account, provider), distance_km: distanceKm, issues };
      }),
    );

    const sorted = candidates
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.issues.length - b.issues.length || (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

    return dataEnvelope(sorted);
  });

  app.post("/admin/requests/:id/reassign", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.operate");
    const { id } = request.params as { id: string };
    const body = reassignBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da reatribuição");

    const row = await loadRequestOrNotFound(id);
    if (!isReassignable(row.status)) {
      throw apiError("invalid_transition", `Não é possível reatribuir um pedido em «${row.status}».`);
    }
    if (row.providerAccountId === body.provider_id) {
      throw apiError("validation", "Escolha um prestador diferente do actual.", {
        issues: [{ field: "provider_id", message: "Escolha um prestador diferente do actual." }],
      });
    }

    const [newProvider] = await db.select().from(providers).where(eq(providers.accountId, body.provider_id)).limit(1);
    if (!newProvider) throw apiError("not_found", "Prestador não encontrado.");

    const pickup = pickupPoint(row);
    const [zoneIds, maxRadiusKm] = await Promise.all([pickup ? zoneIdsCovering(pickup) : Promise.resolve<string[]>([]), maxDispatchRadiusKm()]);
    const { issues } = await reassignEligibilityIssues(newProvider, row, pickup, zoneIds, maxRadiusKm);
    if (issues.length > 0) {
      throw apiError("validation", "O prestador escolhido não é elegível para este pedido.", {
        issues: [{ field: "provider_id", message: issues.join(",") }],
      });
    }
    if (await providerBusyWithOtherRequest(body.provider_id, row.id)) {
      throw apiError("validation", "O prestador escolhido já tem um pedido em curso.");
    }

    const accountsById = await loadProviderAccounts([row.providerAccountId, body.provider_id].filter((item): item is string => Boolean(item)));
    const previousName = row.providerAccountId ? accountsById.get(row.providerAccountId)?.fullName ?? "—" : "—";
    const nextName = accountsById.get(body.provider_id)?.fullName ?? body.provider_id;

    const now = new Date();
    await db
      .update(serviceRequests)
      .set({ providerAccountId: body.provider_id, status: "assigned", updatedAt: now })
      .where(eq(serviceRequests.id, id));
    await db.insert(serviceRequestEvents).values({ id: newId("evt"), requestId: id, status: "assigned", actor: "system", at: now });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "request.reassign",
      targetModule: "request",
      targetId: row.id,
      targetLabel: row.code,
      reason,
      changes: [
        { field: "Prestador", from: previousName, to: nextName },
        { field: "Estado", from: row.status, to: "assigned" },
      ],
      sensitive: true,
    });

    return dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id)));
  });

  app.post("/admin/requests/:id/dispute", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.dispute");
    const { id } = request.params as { id: string };
    const body = disputeBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da disputa");

    const row = await loadRequestOrNotFound(id);
    if (!canOpenDispute(row.status)) {
      throw apiError("invalid_transition", "Só é possível abrir disputa depois da recolha confirmada.");
    }

    const [existing] = await db.select().from(disputes).where(eq(disputes.requestId, id)).limit(1);
    if (existing) {
      throw apiError("invalid_transition", "Este pedido já tem uma disputa registada.");
    }

    await db.insert(disputes).values({
      id: newId("dp"),
      requestId: id,
      reason,
      category: body.category ?? "other",
      openedAt: new Date(),
      openedByAccountId: admin.id,
      notes: [],
    });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "request.dispute",
      targetModule: "request",
      targetId: row.id,
      targetLabel: row.code,
      reason,
      sensitive: true,
    });

    return dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id)));
  });

  app.post("/admin/requests/:id/force-complete", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.operate");
    const { id } = request.params as { id: string };
    const body = forceCompleteBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "a resolução da disputa");

    const row = await loadRequestOrNotFound(id);
    const [dispute] = await db.select().from(disputes).where(eq(disputes.requestId, id)).limit(1);
    if (!dispute || dispute.resolvedAt) {
      throw apiError("invalid_transition", "Só é possível forçar a conclusão de um pedido em disputa.");
    }
    if (!isForceCompletable(row.status)) {
      throw apiError("invalid_transition", `Não é possível forçar a conclusão em «${row.status}».`);
    }

    const fromStatus = row.status;
    const steps = stepsUntil(row.status, "rated");
    let at = Date.now();
    let lastStatus: ServiceRequestStatus = row.status;
    for (const status of steps) {
      await db.insert(serviceRequestEvents).values({ id: newId("evt"), requestId: id, status, actor: "system", at: new Date(at) });
      lastStatus = status;
      at += 1000;
    }

    const updates: Partial<typeof serviceRequests.$inferInsert> = { status: lastStatus, updatedAt: new Date(at) };
    if (!row.proof) {
      updates.proof = {
        photos: [],
        signed_by: "Confirmado pela operação",
        good_condition: true,
        notes: "Conclusão forçada pela administração.",
        delivered_at: new Date(at).toISOString(),
      };
    }
    if (!row.paymentMethod) updates.paymentMethod = "cash";

    await db.update(serviceRequests).set(updates).where(eq(serviceRequests.id, id));

    if (row.providerAccountId && row.providerEarningKz !== null && row.providerEarningKz !== undefined) {
      await creditEarning(row.providerAccountId, id, row.providerEarningKz);
    }

    await db
      .update(disputes)
      .set({ resolvedAt: new Date(), resolvedByAccountId: admin.id, resolution: reason, outcome: dispute.outcome ?? "no_refund" })
      .where(eq(disputes.id, dispute.id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "request.force_complete",
      targetModule: "request",
      targetId: row.id,
      targetLabel: row.code,
      reason,
      changes: [{ field: "Estado", from: fromStatus, to: lastStatus }],
      sensitive: true,
    });

    return dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id)));
  });
}
