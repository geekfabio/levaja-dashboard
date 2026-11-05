import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { providers, serviceRequests, walletTransactions } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { documentsVerified } from "../lib/provider-documents";
import { loadProviderAccounts, presentProvider } from "../lib/provider-presenter";
import { presentServiceRequest } from "../lib/request-presenter";
import { PROVIDER_BUSY_STATUSES } from "../lib/request-state";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ProviderRow = typeof providers.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;

const listQuerySchema = pageQuerySchema.extend({
  status: z.string().optional(),
  verified: z.enum(["true", "false"]).optional(),
  pending_approval: z.enum(["true", "false"]).optional(),
  zone: z.string().optional(),
  service: z.string().optional(),
  q: z.string().optional(),
});

const reasonBodySchema = z.object({ reason: z.string().optional() });

function csv(value: string | undefined) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function displayStatus(provider: ProviderRow) {
  return provider.accountStatus === "suspended" ? "suspended" : provider.online ? "online" : "offline";
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function loadProviderOrNotFound(id: string): Promise<{ account: AccountRow; provider: ProviderRow }> {
  const [provider] = await db.select().from(providers).where(eq(providers.accountId, id)).limit(1);
  if (!provider) throw apiError("not_found", "Prestador não encontrado.");
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!account) throw apiError("not_found", "Prestador não encontrado.");
  return { account, provider };
}

export async function adminProviderRoutes(app: FastifyInstance) {
  app.get("/admin/providers", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const query = listQuerySchema.parse(request.query);

    const statusFilter = csv(query.status);
    const zoneFilter = csv(query.zone);
    const serviceFilter = csv(query.service);

    const providerRows = await db.select().from(providers);
    const filtered = providerRows.filter((provider) => {
      if (statusFilter?.length && !statusFilter.includes(displayStatus(provider))) return false;
      if (query.verified !== undefined && provider.verified !== (query.verified === "true")) return false;
      if (query.pending_approval !== undefined && (provider.accountStatus === "pending_approval") !== (query.pending_approval === "true")) return false;
      if (zoneFilter?.length && !zoneFilter.some((zone) => provider.coverageZoneIds.includes(zone))) return false;
      if (serviceFilter?.length && !serviceFilter.some((service) => provider.coverageServiceTypes.includes(service))) return false;
      return true;
    });

    const accountsById = await loadProviderAccounts(filtered.map((item) => item.accountId));
    const presented = await Promise.all(
      filtered.map(async (provider) => {
        const account = accountsById.get(provider.accountId);
        if (!account) return null;
        return presentProvider(account, provider);
      }),
    );
    const matched = presented
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => matchesText(query.q, item.full_name, item.phone, item.email, item.vehicle?.plate))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt"));

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/providers/positions", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const providerRows = await db.select().from(providers).where(and(eq(providers.online, true), eq(providers.accountStatus, "active")));
    const accountsById = await loadProviderAccounts(providerRows.map((item) => item.accountId));

    const positions = await Promise.all(
      providerRows.map(async (provider) => {
        const account = accountsById.get(provider.accountId);
        if (!account) return null;
        const own = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, provider.accountId));
        const busy = own.find((row) => (PROVIDER_BUSY_STATUSES as readonly string[]).includes(row.status));
        return {
          id: account.id,
          full_name: account.fullName,
          rating: provider.rating !== null ? Number(provider.rating) : null,
          coords: provider.lat !== null && provider.lng !== null ? { lat: Number(provider.lat), lng: Number(provider.lng) } : null,
          services: provider.coverageServiceTypes,
          availability: provider.online ? "online" : "offline",
          active_request_id: busy?.id ?? null,
        };
      }),
    );

    return dataEnvelope(positions.filter((item) => item !== null));
  });

  app.get("/admin/providers/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const { id } = request.params as { id: string };
    const { account, provider } = await loadProviderOrNotFound(id);
    return dataEnvelope(await presentProvider(account, provider));
  });

  app.get("/admin/providers/:id/transactions", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const { id } = request.params as { id: string };
    await loadProviderOrNotFound(id);
    const query = pageQuerySchema.parse(request.query);

    const rows = await db.select().from(walletTransactions).where(eq(walletTransactions.providerAccountId, id));
    const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = sorted.map((row) => ({
      id: row.id,
      kind: row.type,
      title: row.title,
      amount_kz: row.amountKz,
      status: row.status,
      service_type: row.serviceType,
      at: row.createdAt.toISOString(),
    }));

    return listPageEnvelope(paginate(items, query));
  });

  app.get("/admin/providers/:id/reviews", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const { id } = request.params as { id: string };
    await loadProviderOrNotFound(id);
    const query = pageQuerySchema.parse(request.query);

    const own = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, id));
    const rated = own.filter((row) => row.rating !== null);
    const clientsById = await loadProviderAccounts(rated.map((row) => row.clientAccountId));
    const items = rated
      .map((row) => ({
        id: `rv-${row.id}`,
        request_id: row.id,
        author_name: clientsById.get(row.clientAccountId)?.fullName ?? "Cliente",
        rating: row.rating,
        comment: row.review ?? "",
        at: row.updatedAt.toISOString(),
      }))
      .sort((a, b) => (a.at < b.at ? 1 : -1));

    return listPageEnvelope(paginate(items, query));
  });

  app.get("/admin/providers/:id/requests", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const { id } = request.params as { id: string };
    await loadProviderOrNotFound(id);
    const query = pageQuerySchema.parse(request.query);

    const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, id));
    const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = await Promise.all(sorted.map(presentServiceRequest));

    return listPageEnvelope(paginate(items, query));
  });

  app.post("/admin/providers/:id/approve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "providers.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason);

    const { account, provider } = await loadProviderOrNotFound(id);
    if (provider.accountStatus !== "pending_approval") {
      throw apiError("invalid_transition", "Só é possível aprovar prestadores que aguardam aprovação.");
    }
    if (!(await documentsVerified(id))) {
      throw apiError("validation", "Valide os documentos exigidos antes de aprovar o prestador.");
    }

    await db.update(providers).set({ accountStatus: "active", suspensionReason: null }).where(eq(providers.accountId, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "provider.approve",
      targetModule: "provider",
      targetId: id,
      targetLabel: account.fullName,
      reason,
      changes: [{ field: "Estado da conta", from: "Por aprovar", to: "Activo" }],
      sensitive: true,
    });

    const updated = await loadProviderOrNotFound(id);
    return dataEnvelope(await presentProvider(updated.account, updated.provider));
  });

  app.post("/admin/providers/:id/suspend", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "providers.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da suspensão");

    const { account, provider } = await loadProviderOrNotFound(id);
    if (provider.accountStatus === "suspended") {
      throw apiError("invalid_transition", "O prestador já está suspenso.");
    }

    const own = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, id));
    const busy = own.some((row) => (PROVIDER_BUSY_STATUSES as readonly string[]).includes(row.status));
    if (busy) {
      throw apiError("validation", "O prestador tem um pedido em curso. Reatribua-o antes de suspender.");
    }

    await db.update(providers).set({ accountStatus: "suspended", online: false, suspensionReason: reason }).where(eq(providers.accountId, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "provider.suspend",
      targetModule: "provider",
      targetId: id,
      targetLabel: account.fullName,
      reason,
      changes: [{ field: "Estado da conta", from: provider.accountStatus, to: "suspended" }],
      sensitive: true,
    });

    const updated = await loadProviderOrNotFound(id);
    return dataEnvelope(await presentProvider(updated.account, updated.provider));
  });

  app.post("/admin/providers/:id/reactivate", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "providers.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason);

    const { account, provider } = await loadProviderOrNotFound(id);
    if (provider.accountStatus !== "suspended") {
      throw apiError("invalid_transition", "Só é possível reactivar prestadores suspensos.");
    }

    await db.update(providers).set({ accountStatus: "active", suspensionReason: null }).where(eq(providers.accountId, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "provider.reactivate",
      targetModule: "provider",
      targetId: id,
      targetLabel: account.fullName,
      reason,
      changes: [{ field: "Estado da conta", from: "suspended", to: "Activo" }],
      sensitive: true,
    });

    const updated = await loadProviderOrNotFound(id);
    return dataEnvelope(await presentProvider(updated.account, updated.provider));
  });
}
