import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { serviceRequests } from "../db/schema/ops";
import { disputes } from "../db/schema/disputes";
import { refunds } from "../db/schema/refunds";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { listPageEnvelope, pageQuerySchema, csvList, paginate } from "../lib/pagination";
import { presentServiceRequest } from "../lib/request-presenter";
import { recordAdminAudit } from "../lib/admin-audit";
import { committedRefundsKz, isDisputeOverdue, refundableAmountKz } from "../lib/refunds";
import { hasPermission } from "../lib/admin-roles";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";
import { createRefundRecord } from "./admin-refunds";

type DisputeRow = typeof disputes.$inferSelect;
type ServiceRequestRow = typeof serviceRequests.$inferSelect;

export const DISPUTE_CATEGORIES = ["damage", "payment", "price", "no_show", "delay", "conduct", "other"] as const;
const DISPUTE_OUTCOMES = ["no_refund", "refund_full", "refund_partial"] as const;

const listQuerySchema = pageQuerySchema.extend({ state: z.enum(["open", "resolved", "overdue"]).optional(), category: z.string().optional(), q: z.string().optional() });
const noteBodySchema = z.object({ text: z.string().optional() });
const categoryBodySchema = z.object({ category: z.enum(DISPUTE_CATEGORIES) });
const resolveBodySchema = z.object({
  outcome: z.enum(DISPUTE_OUTCOMES),
  amount_kz: z.number().int().positive().optional(),
  charge_provider: z.boolean().optional(),
  resolution: z.string().optional(),
});

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

async function loadDisputeOrNotFound(requestId: string): Promise<DisputeRow> {
  const [row] = await db.select().from(disputes).where(eq(disputes.requestId, requestId)).limit(1);
  if (!row) throw apiError("not_found", "Este pedido não tem disputa.");
  return row;
}

async function loadOpenDisputeOrFail(requestId: string): Promise<DisputeRow> {
  const row = await loadDisputeOrNotFound(requestId);
  if (row.resolvedAt) throw apiError("invalid_transition", "A disputa já foi resolvida.");
  return row;
}

async function accountName(accountId: string | null | undefined) {
  if (!accountId) return undefined;
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return row?.fullName;
}

async function presentDispute(dispute: DisputeRow) {
  const [openedBy, resolvedBy] = await Promise.all([accountName(dispute.openedByAccountId), accountName(dispute.resolvedByAccountId)]);
  return {
    reason: dispute.reason,
    category: dispute.category,
    opened_at: dispute.openedAt.toISOString(),
    opened_by: openedBy ?? null,
    notes: dispute.notes,
    resolved_at: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
    resolved_by: resolvedBy ?? null,
    resolution: dispute.resolution,
    outcome: dispute.outcome,
    refund_id: dispute.refundId,
  };
}

async function presentCase(dispute: DisputeRow, now: Date) {
  const requestRow = await loadRequestOrNotFound(dispute.requestId);
  const requestRefunds = await db.select().from(refunds).where(eq(refunds.requestId, dispute.requestId));
  const totalKz = (requestRow.pricing as { total_kz?: number } | null)?.total_kz ?? 0;

  return {
    request: await presentServiceRequest(requestRow),
    dispute: await presentDispute(dispute),
    refundable_kz: refundableAmountKz({ status: requestRow.status, totalKz }, requestRefunds, dispute.requestId),
    refunded_kz: committedRefundsKz(requestRefunds, dispute.requestId),
    overdue: isDisputeOverdue({ openedAt: dispute.openedAt, resolvedAt: dispute.resolvedAt }, now),
  };
}

export async function adminDisputeRoutes(app: FastifyInstance) {
  app.get("/admin/disputes", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.dispute");
    const query = listQuerySchema.parse(request.query);
    const categoryFilter = csvList(query.category);
    if (categoryFilter && !categoryFilter.every((value) => (DISPUTE_CATEGORIES as readonly string[]).includes(value))) {
      throw apiError("validation", "Categoria de disputa inválida.");
    }

    const now = new Date();
    const rows = await db.select().from(disputes).orderBy(desc(disputes.openedAt));
    const filteredByState = rows.filter((row) => {
      if (query.state === "open" && row.resolvedAt) return false;
      if (query.state === "resolved" && !row.resolvedAt) return false;
      if (query.state === "overdue" && !isDisputeOverdue({ openedAt: row.openedAt, resolvedAt: row.resolvedAt }, now)) return false;
      if (categoryFilter?.length && !categoryFilter.includes(row.category ?? "other")) return false;
      return true;
    });

    const cases = await Promise.all(filteredByState.map((row) => presentCase(row, now)));
    const matched = cases.filter((item) =>
      matchesText(query.q, item.request.code, item.request.client?.full_name, item.request.provider?.full_name, item.dispute.reason),
    );

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/disputes/summary", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "requests.dispute");
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db.select().from(disputes);
    const resolvedLast30 = rows.filter((row) => row.resolvedAt && row.resolvedAt >= since);
    const refundRows = await db.select().from(refunds);
    const refundedLast30 = refundRows
      .filter((row) => row.source === "dispute" && row.status !== "rejected" && row.requestedAt >= since)
      .reduce((sum, row) => sum + row.amountKz, 0);

    return dataEnvelope({
      open: rows.filter((row) => !row.resolvedAt).length,
      overdue: rows.filter((row) => isDisputeOverdue({ openedAt: row.openedAt, resolvedAt: row.resolvedAt }, now)).length,
      resolved_last_30: resolvedLast30.length,
      refunded_last_30_kz: refundedLast30,
    });
  });

  app.post("/admin/disputes/:requestId/notes", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.dispute");
    const { requestId } = request.params as { requestId: string };
    const body = noteBodySchema.parse(request.body);
    const note = requireReason(body.text, "o texto da nota");

    const dispute = await loadOpenDisputeOrFail(requestId);
    const notes = [...dispute.notes, { id: newId("dn"), author: admin.fullName, text: note, at: new Date().toISOString() }];
    await db.update(disputes).set({ notes }).where(eq(disputes.id, dispute.id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "dispute.note",
      targetModule: "request",
      targetId: requestId,
      targetLabel: (await loadRequestOrNotFound(requestId)).code,
      reason: note,
    });

    return dataEnvelope(await presentCase(await loadOpenDisputeOrFail(requestId), new Date()));
  });

  app.patch("/admin/disputes/:requestId/category", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.dispute");
    const { requestId } = request.params as { requestId: string };
    const body = categoryBodySchema.parse(request.body);

    const dispute = await loadOpenDisputeOrFail(requestId);
    const from = dispute.category ?? "other";
    await db.update(disputes).set({ category: body.category }).where(eq(disputes.id, dispute.id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "dispute.note",
      targetModule: "request",
      targetId: requestId,
      targetLabel: (await loadRequestOrNotFound(requestId)).code,
      reason: "Categoria da disputa alterada.",
      changes: [{ field: "Categoria", from, to: body.category }],
    });

    return dataEnvelope(await presentCase(await loadOpenDisputeOrFail(requestId), new Date()));
  });

  app.post("/admin/disputes/:requestId/resolve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "requests.dispute");
    const { requestId } = request.params as { requestId: string };
    const body = resolveBodySchema.parse(request.body);
    const resolution = requireReason(body.resolution, "a resolução da disputa");

    const dispute = await loadOpenDisputeOrFail(requestId);
    const requestRow = await loadRequestOrNotFound(requestId);

    let refundId: string | undefined;
    const changes: { field: string; from: string; to: string }[] = [{ field: "Resultado", from: "—", to: body.outcome }];

    if (body.outcome !== "no_refund") {
      if (!hasPermission(admin.adminRole!, "refunds.request")) {
        throw apiError("forbidden", "O seu papel não pode pedir reembolsos.");
      }
      const existingRefunds = await db.select().from(refunds).where(eq(refunds.requestId, requestId));
      const totalKz = (requestRow.pricing as { total_kz?: number } | null)?.total_kz ?? 0;
      const available = refundableAmountKz({ status: requestRow.status, totalKz }, existingRefunds, requestId);
      if (available <= 0) {
        throw apiError("validation", "O pedido não tem valor pago por reembolsar. Resolva sem reembolso.");
      }
      const amountKz = body.outcome === "refund_full" ? available : Math.round(body.amount_kz ?? 0);
      if (body.outcome === "refund_partial" && amountKz >= available) {
        throw apiError("validation", "Um reembolso parcial tem de ser menor do que o valor por reembolsar.", {
          issues: [{ field: "amount_kz", message: "Para devolver tudo, escolha reembolso total." }],
        });
      }
      const refund = await createRefundRecord({
        requestRow,
        amountKz,
        reason: resolution,
        chargeProvider: Boolean(body.charge_provider),
        source: "dispute",
        requestedByAccountId: admin.id,
      });
      refundId = refund.id;
      changes.push({ field: "Reembolso", from: "—", to: `${refund.code} · ${refund.amountKz}` });
    }

    await db
      .update(disputes)
      .set({ resolvedAt: new Date(), resolvedByAccountId: admin.id, resolution, outcome: body.outcome, refundId })
      .where(eq(disputes.id, dispute.id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "dispute.resolve",
      targetModule: "request",
      targetId: requestId,
      targetLabel: requestRow.code,
      reason: resolution,
      changes,
      sensitive: true,
    });

    return dataEnvelope(await presentCase(await loadDisputeOrNotFound(requestId), new Date()));
  });
}
