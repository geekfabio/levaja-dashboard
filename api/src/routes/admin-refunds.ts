import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { serviceRequests } from "../db/schema/ops";
import { refunds } from "../db/schema/refunds";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { listPageEnvelope, pageQuerySchema, csvList, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import {
  committedRefundsKz,
  needsSecondApprover,
  refundableAmountKz,
  REFUND_WINDOW_DAYS,
} from "../lib/refunds";
import { hasPermission } from "../lib/admin-roles";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

function requireAnyRefundPermission(role: Parameters<typeof hasPermission>[0]) {
  if (!hasPermission(role, "refunds.request") && !hasPermission(role, "refunds.decide")) {
    throw apiError("forbidden", "O seu papel não tem permissão para esta acção.");
  }
}

type RefundRow = typeof refunds.$inferSelect;
type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const REFUND_STATUSES = ["pending", "approved", "rejected", "paid"] as const;
const REFUND_SOURCES = ["dispute", "cancellation", "manual"] as const;

const listQuerySchema = pageQuerySchema.extend({ status: z.string().optional(), source: z.string().optional(), q: z.string().optional() });
const createBodySchema = z.object({
  request_id: z.string(),
  amount_kz: z.number().int().positive(),
  reason: z.string(),
  charge_provider: z.boolean().optional(),
});
const decideBodySchema = z.object({ reason: z.string().optional() });
const markPaidBodySchema = z.object({ payment_reference: z.string() });

const DAY_MS = 24 * 60 * 60 * 1000;

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

async function loadRefundOrNotFound(id: string): Promise<RefundRow> {
  const [row] = await db.select().from(refunds).where(eq(refunds.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Reembolso não encontrado.");
  return row;
}

async function accountName(accountId: string | null | undefined) {
  if (!accountId) return undefined;
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return row?.fullName;
}

async function present(refund: RefundRow) {
  const request = await loadRequestOrNotFound(refund.requestId);
  const [clientName, providerName, requestedBy, decidedBy] = await Promise.all([
    accountName(request.clientAccountId),
    accountName(request.providerAccountId),
    accountName(refund.requestedByAccountId),
    accountName(refund.decidedByAccountId),
  ]);

  return {
    id: refund.id,
    code: refund.code,
    request_id: refund.requestId,
    request_code: request.code,
    client_id: request.clientAccountId,
    client_name: clientName ?? "Cliente",
    provider_id: request.providerAccountId,
    provider_name: providerName,
    amount_kz: refund.amountKz,
    reason: refund.reason,
    source: refund.source,
    charge_provider: refund.chargeProvider,
    payment_method: request.paymentMethod,
    status: refund.status,
    requested_at: refund.requestedAt.toISOString(),
    requested_by: requestedBy ?? "Sistema",
    requested_by_account_id: refund.requestedByAccountId,
    decided_at: refund.decidedAt ? refund.decidedAt.toISOString() : null,
    decided_by: decidedBy ?? null,
    decision_reason: refund.decisionReason,
    paid_at: refund.paidAt ? refund.paidAt.toISOString() : null,
    payment_reference: refund.paymentReference,
  };
}

export async function createRefundRecord(options: {
  requestRow: ServiceRequestRow;
  amountKz: number;
  reason: string;
  chargeProvider: boolean;
  source: (typeof REFUND_SOURCES)[number];
  requestedByAccountId: string;
}): Promise<RefundRow> {
  const { requestRow, amountKz, reason, chargeProvider, source, requestedByAccountId } = options;
  const existingRefunds = await db.select().from(refunds).where(eq(refunds.requestId, requestRow.id));
  const available = refundableAmountKz(
    { status: requestRow.status, totalKz: (requestRow.pricing as { total_kz?: number } | null)?.total_kz ?? 0 },
    existingRefunds,
    requestRow.id,
  );

  const trimmedReason = reason.trim();
  if (available <= 0) throw apiError("validation", "Este pedido não tem valor por reembolsar.");
  if (!Number.isInteger(amountKz) || amountKz <= 0) {
    throw apiError("validation", "Indique um valor inteiro maior que zero.", { issues: [{ field: "amount_kz", message: "Indique um valor inteiro maior que zero." }] });
  }
  if (amountKz > available) {
    throw apiError("validation", "O valor não pode passar o que falta reembolsar.", { issues: [{ field: "amount_kz", message: "O valor não pode passar o que falta reembolsar." }] });
  }
  if (trimmedReason.length < 3) {
    throw apiError("validation", "Indique o motivo do reembolso.", { issues: [{ field: "reason", message: "Indique o motivo do reembolso." }] });
  }

  const paidEvent = requestRow.status === "paid" || requestRow.status === "rated" ? requestRow.updatedAt : null;
  if (paidEvent) {
    const limit = paidEvent.getTime() + REFUND_WINDOW_DAYS * DAY_MS;
    if (Date.now() > limit) {
      throw apiError("validation", `O prazo de ${REFUND_WINDOW_DAYS} dias para pedir reembolso já passou.`);
    }
  }

  const sequenceRows = await db.select({ code: refunds.code }).from(refunds);
  const sequence = sequenceRows.reduce((max, row) => Math.max(max, Number(row.code.replace(/\D/g, "")) || 0), 1000) + 1;

  const [refund] = await db
    .insert(refunds)
    .values({
      id: newId("rf"),
      code: `RE-${sequence}`,
      requestId: requestRow.id,
      amountKz,
      reason: trimmedReason,
      source,
      chargeProvider: Boolean(chargeProvider && requestRow.providerAccountId),
      status: "pending",
      requestedByAccountId,
    })
    .returning();

  await recordAdminAudit({
    actorAccountId: requestedByAccountId,
    action: "refund.request",
    targetModule: "refund",
    targetId: refund!.id,
    targetLabel: `${refund!.code} — ${requestRow.code}`,
    reason: trimmedReason,
    changes: [
      { field: "Valor", from: "—", to: String(amountKz) },
      { field: "Imputado ao prestador", from: "—", to: refund!.chargeProvider ? "Sim" : "Não" },
    ],
    sensitive: true,
  });

  return refund!;
}

export async function adminRefundRoutes(app: FastifyInstance) {
  app.get("/admin/refunds", { preHandler: [authenticateAdmin] }, async (request) => {
    requireAnyRefundPermission(request.adminAccount!.adminRole!);
    const query = listQuerySchema.parse(request.query);

    const statusFilter = csvList(query.status);
    if (statusFilter && !statusFilter.every((value) => (REFUND_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de reembolso inválido.");
    }
    const sourceFilter = csvList(query.source);
    if (sourceFilter && !sourceFilter.every((value) => (REFUND_SOURCES as readonly string[]).includes(value))) {
      throw apiError("validation", "Origem de reembolso inválida.");
    }

    const rows = await db.select().from(refunds).orderBy(desc(refunds.requestedAt));
    const filtered = rows.filter((row) => {
      if (statusFilter?.length && !statusFilter.includes(row.status)) return false;
      if (sourceFilter?.length && !sourceFilter.includes(row.source)) return false;
      return true;
    });
    const presented = await Promise.all(filtered.map(present));
    const matched = presented.filter((item) =>
      matchesText(query.q, item.code, item.request_code, item.client_name, item.provider_name, item.payment_reference),
    );

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/refunds/summary", { preHandler: [authenticateAdmin] }, async (request) => {
    requireAnyRefundPermission(request.adminAccount!.adminRole!);
    const rows = await db.select().from(refunds);
    const since = new Date(Date.now() - 30 * DAY_MS);
    const pending = rows.filter((row) => row.status === "pending");

    return dataEnvelope({
      pending_count: pending.length,
      pending_amount_kz: pending.reduce((sum, row) => sum + row.amountKz, 0),
      approved_amount_kz: rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + row.amountKz, 0),
      paid_last_30_kz: rows.filter((row) => row.status === "paid" && row.paidAt && row.paidAt >= since).reduce((sum, row) => sum + row.amountKz, 0),
    });
  });

  app.get("/admin/requests/:requestId/refunds", { preHandler: [authenticateAdmin] }, async (request) => {
    requireAnyRefundPermission(request.adminAccount!.adminRole!);
    const { requestId } = request.params as { requestId: string };
    const requestRow = await loadRequestOrNotFound(requestId);
    const rows = await db.select().from(refunds).where(eq(refunds.requestId, requestId)).orderBy(desc(refunds.requestedAt));

    return dataEnvelope({
      refunds: await Promise.all(rows.map(present)),
      refundable_kz: refundableAmountKz(
        { status: requestRow.status, totalKz: (requestRow.pricing as { total_kz?: number } | null)?.total_kz ?? 0 },
        rows,
        requestId,
      ),
      paid_at: requestRow.status === "paid" || requestRow.status === "rated" ? requestRow.updatedAt.toISOString() : null,
    });
  });

  app.post("/admin/refunds", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "refunds.request");
    const body = createBodySchema.parse(request.body);

    const requestRow = await loadRequestOrNotFound(body.request_id);
    const refund = await createRefundRecord({
      requestRow,
      amountKz: body.amount_kz,
      reason: body.reason,
      chargeProvider: Boolean(body.charge_provider),
      source: "manual",
      requestedByAccountId: admin.id,
    });

    return dataEnvelope(await present(await loadRefundOrNotFound(refund.id)));
  });

  app.post("/admin/refunds/:id/approve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "refunds.decide");
    const { id } = request.params as { id: string };
    const body = decideBodySchema.parse(request.body);

    const refund = await loadRefundOrNotFound(id);
    if (refund.status !== "pending") {
      throw apiError("invalid_transition", `Só é possível aprovar um reembolso por aprovar (está «${refund.status}»).`);
    }
    if (needsSecondApprover(refund.amountKz) && refund.requestedByAccountId === admin.id) {
      throw apiError("forbidden", `Reembolsos acima do limite de dupla aprovação têm de ser aprovados por outra pessoa.`);
    }

    const requestRow = await loadRequestOrNotFound(refund.requestId);
    const siblings = await db.select().from(refunds).where(eq(refunds.requestId, requestRow.id));
    const totalKz = (requestRow.pricing as { total_kz?: number } | null)?.total_kz ?? 0;
    if (committedRefundsKz(siblings, requestRow.id, refund.id) + refund.amountKz > totalKz) {
      throw apiError("validation", "O total reembolsado passaria o valor pago pelo cliente.");
    }

    const reason = body.reason?.trim() || null;
    await db
      .update(refunds)
      .set({ status: "approved", decidedAt: new Date(), decidedByAccountId: admin.id, decisionReason: reason })
      .where(eq(refunds.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "refund.approve",
      targetModule: "refund",
      targetId: id,
      targetLabel: `${refund.code} — ${requestRow.code}`,
      reason: reason ?? undefined,
      changes: [{ field: "Estado", from: "pending", to: "approved" }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadRefundOrNotFound(id)));
  });

  app.post("/admin/refunds/:id/reject", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "refunds.decide");
    const { id } = request.params as { id: string };
    const body = decideBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da rejeição");

    const refund = await loadRefundOrNotFound(id);
    if (refund.status !== "pending" && refund.status !== "approved") {
      throw apiError("invalid_transition", `Não é possível rejeitar um reembolso «${refund.status}».`);
    }

    await db
      .update(refunds)
      .set({ status: "rejected", decidedAt: new Date(), decidedByAccountId: admin.id, decisionReason: reason })
      .where(eq(refunds.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "refund.reject",
      targetModule: "refund",
      targetId: id,
      targetLabel: refund.code,
      reason,
      changes: [{ field: "Estado", from: refund.status, to: "rejected" }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadRefundOrNotFound(id)));
  });

  app.post("/admin/refunds/:id/mark-paid", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "refunds.decide");
    const { id } = request.params as { id: string };
    const body = markPaidBodySchema.parse(request.body);

    const refund = await loadRefundOrNotFound(id);
    if (refund.status !== "approved") {
      throw apiError("invalid_transition", "Só é possível pagar um reembolso aprovado.");
    }
    const reference = body.payment_reference.trim();
    if (reference.length < 3) {
      throw apiError("validation", "Indique a referência da devolução.", { issues: [{ field: "payment_reference", message: "Indique a referência da devolução." }] });
    }

    await db
      .update(refunds)
      .set({ status: "paid", paidAt: new Date(), paymentReference: reference })
      .where(eq(refunds.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "refund.paid",
      targetModule: "refund",
      targetId: id,
      targetLabel: refund.code,
      reason: `Referência ${reference}`,
      changes: [{ field: "Estado", from: "approved", to: "paid" }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadRefundOrNotFound(id)));
  });
}
