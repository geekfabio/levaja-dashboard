import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { clients, serviceRequests, supportTickets } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { presentClient } from "../lib/client-presenter";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { presentServiceRequest } from "../lib/request-presenter";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ClientRow = typeof clients.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;

const listQuerySchema = pageQuerySchema.extend({ q: z.string().optional(), blocked: z.enum(["true", "false"]).optional() });
const reasonBodySchema = z.object({ reason: z.string().optional() });

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function loadClientOrNotFound(id: string): Promise<{ account: AccountRow; client: ClientRow }> {
  const [client] = await db.select().from(clients).where(eq(clients.accountId, id)).limit(1);
  if (!client) throw apiError("not_found", "Cliente não encontrado.");
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!account) throw apiError("not_found", "Cliente não encontrado.");
  return { account, client };
}

export async function adminClientRoutes(app: FastifyInstance) {
  app.get("/admin/clients", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "clients.view");
    const query = listQuerySchema.parse(request.query);

    const clientRows = await db.select().from(clients);
    const filteredClients = clientRows.filter((client) => query.blocked === undefined || client.blocked === (query.blocked === "true"));

    const presented = await Promise.all(
      filteredClients.map(async (client) => {
        const [account] = await db.select().from(accounts).where(eq(accounts.id, client.accountId)).limit(1);
        if (!account) return null;
        return presentClient(account, client);
      }),
    );
    const matched = presented
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => matchesText(query.q, item.full_name, item.email, item.phone))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt"));

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/clients/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "clients.view");
    const { id } = request.params as { id: string };
    const { account, client } = await loadClientOrNotFound(id);
    return dataEnvelope(await presentClient(account, client));
  });

  app.get("/admin/clients/:id/requests", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "clients.view");
    const { id } = request.params as { id: string };
    await loadClientOrNotFound(id);
    const query = pageQuerySchema.parse(request.query);

    const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.clientAccountId, id));
    const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = await Promise.all(sorted.map(presentServiceRequest));

    return listPageEnvelope(paginate(items, query));
  });

  app.get("/admin/clients/:id/reviews", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "clients.view");
    const { id } = request.params as { id: string };
    await loadClientOrNotFound(id);

    const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.clientAccountId, id));
    const items = rows
      .filter((row) => row.rating !== null)
      .map((row) => ({ id: `rv-${row.id}`, request_id: row.id, rating: row.rating, comment: row.review ?? "", at: row.updatedAt.toISOString() }))
      .sort((a, b) => (a.at < b.at ? 1 : -1));

    return dataEnvelope(items);
  });

  app.get("/admin/clients/:id/tickets", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "clients.view");
    const { id } = request.params as { id: string };
    await loadClientOrNotFound(id);

    const rows = await db.select().from(supportTickets).where(eq(supportTickets.accountId, id));
    const items = [...rows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => ({
        id: row.id,
        code: row.code,
        request_id: row.requestId,
        reason: row.reason,
        description: row.description,
        created_at: row.createdAt.toISOString(),
      }));

    return dataEnvelope(items);
  });

  app.post("/admin/clients/:id/block", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "clients.block");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo do bloqueio");

    const { account, client } = await loadClientOrNotFound(id);
    if (client.blocked) throw apiError("invalid_transition", "O cliente já está bloqueado.");

    await db.update(clients).set({ blocked: true, blockedReason: reason }).where(eq(clients.accountId, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "client.block",
      targetModule: "client",
      targetId: id,
      targetLabel: account.fullName,
      reason,
      changes: [{ field: "Estado", from: "Activo", to: "Bloqueado" }],
      sensitive: true,
    });

    const updated = await loadClientOrNotFound(id);
    return dataEnvelope(await presentClient(updated.account, updated.client));
  });

  app.post("/admin/clients/:id/unblock", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "clients.block");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo do desbloqueio");

    const { account, client } = await loadClientOrNotFound(id);
    if (!client.blocked) throw apiError("invalid_transition", "O cliente não está bloqueado.");

    await db.update(clients).set({ blocked: false, blockedReason: null }).where(eq(clients.accountId, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "client.unblock",
      targetModule: "client",
      targetId: id,
      targetLabel: account.fullName,
      reason,
      changes: [{ field: "Estado", from: "Bloqueado", to: "Activo" }],
      sensitive: true,
    });

    const updated = await loadClientOrNotFound(id);
    return dataEnvelope(await presentClient(updated.account, updated.client));
  });
}
