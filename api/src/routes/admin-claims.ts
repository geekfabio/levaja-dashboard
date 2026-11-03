import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { serviceRequests } from "../db/schema/ops";
import { claims } from "../db/schema/claims";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { listPageEnvelope, pageQuerySchema, csvList, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ClaimRow = typeof claims.$inferSelect;
type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const CLAIM_KINDS = ["cargo_damage", "vehicle_damage", "accident", "theft", "injury"] as const;
const CLAIM_STATUSES = ["reported", "under_review", "approved", "rejected", "paid"] as const;
const OPEN_STATUSES = new Set(["reported", "under_review"]);
const CLAIMABLE_REQUEST_STATUSES = new Set(["delivered", "paid", "rated"]);

const listQuerySchema = pageQuerySchema.extend({ status: z.string().optional(), kind: z.string().optional(), q: z.string().optional() });
const reportBodySchema = z.object({
  request_id: z.string(),
  kind: z.enum(CLAIM_KINDS),
  description: z.string(),
  estimated_amount_kz: z.number().int().positive(),
  occurred_at: z.string(),
});
const startReviewBodySchema = z.object({ insurer: z.string(), policy_number: z.string() });
const noteBodySchema = z.object({ text: z.string().optional() });
const approveBodySchema = z.object({ amount_kz: z.number().int().positive(), reason: z.string().optional() });
const rejectBodySchema = z.object({ reason: z.string().optional() });
const markPaidBodySchema = z.object({ payment_reference: z.string().optional() });

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

async function loadClaimOrNotFound(id: string): Promise<ClaimRow> {
  const [row] = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Sinistro não encontrado.");
  return row;
}

async function accountName(accountId: string | null | undefined) {
  if (!accountId) return undefined;
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return row?.fullName;
}

async function present(claim: ClaimRow) {
  const request = await loadRequestOrNotFound(claim.requestId);
  const [clientName, providerName, reportedBy, decidedBy] = await Promise.all([
    accountName(request.clientAccountId),
    accountName(request.providerAccountId),
    accountName(claim.reportedByAccountId),
    accountName(claim.decidedByAccountId),
  ]);

  return {
    id: claim.id,
    code: claim.code,
    request_id: claim.requestId,
    request_code: request.code,
    client_id: request.clientAccountId,
    client_name: clientName ?? "Cliente",
    provider_id: request.providerAccountId,
    provider_name: providerName,
    kind: claim.kind,
    description: claim.description,
    occurred_at: claim.occurredAt.toISOString(),
    reported_at: claim.reportedAt.toISOString(),
    reported_by: reportedBy ?? "Sistema",
    estimated_amount_kz: claim.estimatedAmountKz,
    status: claim.status,
    insurer: claim.insurer,
    policy_number: claim.policyNumber,
    approved_amount_kz: claim.approvedAmountKz,
    decision_reason: claim.decisionReason,
    decided_at: claim.decidedAt ? claim.decidedAt.toISOString() : null,
    decided_by: decidedBy ?? null,
    paid_at: claim.paidAt ? claim.paidAt.toISOString() : null,
    payment_reference: claim.paymentReference,
    notes: claim.notes,
    photo_ids: claim.photoIds,
  };
}

function requireView(role: Parameters<typeof requirePermission>[0]) {
  requirePermission(role, "claims.view");
}

function requireManage(role: Parameters<typeof requirePermission>[0]) {
  requirePermission(role, "claims.manage");
}

export async function adminClaimRoutes(app: FastifyInstance) {
  app.get("/admin/claims", { preHandler: [authenticateAdmin] }, async (request) => {
    requireView(request.adminAccount!.adminRole!);
    const query = listQuerySchema.parse(request.query);

    const statusFilter = csvList(query.status);
    if (statusFilter && !statusFilter.every((value) => (CLAIM_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de sinistro inválido.");
    }
    const kindFilter = csvList(query.kind);
    if (kindFilter && !kindFilter.every((value) => (CLAIM_KINDS as readonly string[]).includes(value))) {
      throw apiError("validation", "Tipo de sinistro inválido.");
    }

    const rows = await db.select().from(claims).orderBy(desc(claims.reportedAt));
    const filtered = rows.filter((row) => {
      if (statusFilter?.length && !statusFilter.includes(row.status)) return false;
      if (kindFilter?.length && !kindFilter.includes(row.kind)) return false;
      return true;
    });
    const presented = await Promise.all(filtered.map(present));
    const matched = presented.filter((item) =>
      matchesText(query.q, item.code, item.request_code, item.client_name, item.provider_name, item.insurer),
    );

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/claims/summary", { preHandler: [authenticateAdmin] }, async (request) => {
    requireView(request.adminAccount!.adminRole!);
    const now = new Date();
    const since = new Date(now.getTime() - 90 * DAY_MS);
    const rows = await db.select().from(claims);
    const open = rows.filter((row) => OPEN_STATUSES.has(row.status));

    return dataEnvelope({
      open: open.length,
      under_review: rows.filter((row) => row.status === "under_review").length,
      open_estimated_kz: open.reduce((sum, row) => sum + row.estimatedAmountKz, 0),
      paid_last_90_kz: rows
        .filter((row) => row.status === "paid" && row.paidAt && row.paidAt >= since)
        .reduce((sum, row) => sum + (row.approvedAmountKz ?? 0), 0),
    });
  });

  app.get("/admin/claims/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requireView(request.adminAccount!.adminRole!);
    const { id } = request.params as { id: string };
    return dataEnvelope(await present(await loadClaimOrNotFound(id)));
  });

  app.get("/admin/requests/:requestId/claims", { preHandler: [authenticateAdmin] }, async (request) => {
    requireView(request.adminAccount!.adminRole!);
    const { requestId } = request.params as { requestId: string };
    const rows = await db.select().from(claims).where(eq(claims.requestId, requestId)).orderBy(desc(claims.reportedAt));
    return dataEnvelope(await Promise.all(rows.map(present)));
  });

  app.post("/admin/claims", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requireView(admin.adminRole!);
    const body = reportBodySchema.parse(request.body);

    const requestRow = await loadRequestOrNotFound(body.request_id);
    if (!CLAIMABLE_REQUEST_STATUSES.has(requestRow.status)) {
      throw apiError("invalid_transition", `Só é possível participar um sinistro depois da recolha (o pedido está «${requestRow.status}»).`);
    }

    const description = body.description.trim();
    if (description.length < 3) {
      throw apiError("validation", "Descreva o sinistro.", { issues: [{ field: "description", message: "Descreva o sinistro." }] });
    }
    const occurredAt = new Date(body.occurred_at);
    if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now()) {
      throw apiError("validation", "Indique a data em que ocorreu o sinistro.", { issues: [{ field: "occurred_at", message: "A data não pode ser no futuro." }] });
    }

    const sequenceRows = await db.select({ code: claims.code }).from(claims);
    const sequence = sequenceRows.reduce((max, row) => Math.max(max, Number(row.code.replace(/\D/g, "")) || 0), 1000) + 1;
    const photos = (requestRow.photos as { id: string; stage: string }[] | null) ?? [];

    const [claim] = await db
      .insert(claims)
      .values({
        id: newId("sn"),
        code: `SN-${sequence}`,
        requestId: requestRow.id,
        kind: body.kind,
        description,
        occurredAt,
        reportedByAccountId: admin.id,
        estimatedAmountKz: body.estimated_amount_kz,
        status: "reported",
        photoIds: photos.filter((photo) => photo.stage === "damage").map((photo) => photo.id),
      })
      .returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "claim.report",
      targetModule: "claim",
      targetId: claim!.id,
      targetLabel: `${claim!.code} — ${requestRow.code}`,
      reason: description,
      changes: [{ field: "Valor estimado", from: "—", to: String(body.estimated_amount_kz) }],
    });

    return dataEnvelope(await present(await loadClaimOrNotFound(claim!.id)));
  });

  app.post("/admin/claims/:id/start-review", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requireManage(admin.adminRole!);
    const { id } = request.params as { id: string };
    const body = startReviewBodySchema.parse(request.body);

    const claim = await loadClaimOrNotFound(id);
    if (claim.status !== "reported") throw apiError("invalid_transition", "Só um sinistro participado pode entrar em análise.");

    const insurer = requireReason(body.insurer, "a seguradora");
    const policyNumber = requireReason(body.policy_number, "o número da apólice");

    await db.update(claims).set({ status: "under_review", insurer, policyNumber }).where(eq(claims.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "claim.review",
      targetModule: "claim",
      targetId: id,
      targetLabel: claim.code,
      reason: `${insurer} · apólice ${policyNumber}`,
      changes: [{ field: "Estado", from: "reported", to: "under_review" }],
    });

    return dataEnvelope(await present(await loadClaimOrNotFound(id)));
  });

  app.post("/admin/claims/:id/notes", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requireView(admin.adminRole!);
    const { id } = request.params as { id: string };
    const body = noteBodySchema.parse(request.body);
    const note = requireReason(body.text, "o texto da nota");

    const claim = await loadClaimOrNotFound(id);
    if (!OPEN_STATUSES.has(claim.status)) throw apiError("invalid_transition", "O sinistro já está fechado.");

    const notes = [...claim.notes, { id: newId("sno"), author: admin.fullName, text: note, at: new Date().toISOString() }];
    await db.update(claims).set({ notes }).where(eq(claims.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "claim.note",
      targetModule: "claim",
      targetId: id,
      targetLabel: claim.code,
      reason: note,
    });

    return dataEnvelope(await present(await loadClaimOrNotFound(id)));
  });

  app.post("/admin/claims/:id/approve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requireManage(admin.adminRole!);
    const { id } = request.params as { id: string };
    const body = approveBodySchema.parse(request.body);

    const claim = await loadClaimOrNotFound(id);
    if (claim.status !== "under_review") throw apiError("invalid_transition", "Só é possível aprovar um sinistro em análise.");
    if (body.amount_kz > claim.estimatedAmountKz * 1.5) {
      throw apiError("validation", "O valor passa 150% do estimado. Actualize a estimativa primeiro.", {
        issues: [{ field: "amount_kz", message: "Valor demasiado alto face ao estimado." }],
      });
    }
    const reason = requireReason(body.reason, "a justificação");

    await db
      .update(claims)
      .set({ status: "approved", approvedAmountKz: body.amount_kz, decisionReason: reason, decidedAt: new Date(), decidedByAccountId: admin.id })
      .where(eq(claims.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "claim.approve",
      targetModule: "claim",
      targetId: id,
      targetLabel: claim.code,
      reason,
      changes: [{ field: "Estado", from: "under_review", to: "approved" }, { field: "Indemnização", from: "—", to: String(body.amount_kz) }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadClaimOrNotFound(id)));
  });

  app.post("/admin/claims/:id/reject", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requireManage(admin.adminRole!);
    const { id } = request.params as { id: string };
    const body = rejectBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da recusa");

    const claim = await loadClaimOrNotFound(id);
    if (!OPEN_STATUSES.has(claim.status)) throw apiError("invalid_transition", "O sinistro já foi decidido.");

    await db.update(claims).set({ status: "rejected", decisionReason: reason, decidedAt: new Date(), decidedByAccountId: admin.id }).where(eq(claims.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "claim.reject",
      targetModule: "claim",
      targetId: id,
      targetLabel: claim.code,
      reason,
      changes: [{ field: "Estado", from: claim.status, to: "rejected" }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadClaimOrNotFound(id)));
  });

  app.post("/admin/claims/:id/mark-paid", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requireManage(admin.adminRole!);
    const { id } = request.params as { id: string };
    const body = markPaidBodySchema.parse(request.body);
    const reference = requireReason(body.payment_reference, "a referência do pagamento");

    const claim = await loadClaimOrNotFound(id);
    if (claim.status !== "approved") throw apiError("invalid_transition", "Só é possível pagar um sinistro aprovado.");

    await db.update(claims).set({ status: "paid", paidAt: new Date(), paymentReference: reference }).where(eq(claims.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "claim.paid",
      targetModule: "claim",
      targetId: id,
      targetLabel: claim.code,
      reason: `Referência ${reference}`,
      changes: [{ field: "Estado", from: "approved", to: "paid" }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadClaimOrNotFound(id)));
  });
}
