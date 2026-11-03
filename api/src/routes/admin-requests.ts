import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { serviceRequestEvents, serviceRequests } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { presentServiceRequest } from "../lib/request-presenter";
import { ACTIVE_REQUEST_STATUSES, isCancellable } from "../lib/request-state";
import type { ServiceRequestStatus } from "../lib/request-state";
import { recordAdminAudit } from "../lib/admin-audit";
import { newId } from "../lib/ids";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;

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
}
