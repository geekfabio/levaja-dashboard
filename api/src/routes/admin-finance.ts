import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { payoutBatches, withdrawals } from "../db/schema/finance";
import { providers, serviceRequests, wallets, walletTransactions } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;
type WithdrawalRow = typeof withdrawals.$inferSelect;
type PayoutBatchRow = typeof payoutBatches.$inferSelect;

const SERVICE_KINDS = ["tow", "cargo", "small_move", "house_move"] as const;
const SETTLED_STATUSES = ["paid", "rated"] as const;
const MINIMUM_WITHDRAWAL_KZ = 5000;
const DEFAULT_IBAN = "AO06 0000 0000 0000 0000 0000 0";

const dateRangeQuerySchema = z.object({ from: z.string(), to: z.string() });

const withdrawalsQuerySchema = pageQuerySchema.extend({ status: z.string().optional(), q: z.string().optional() });

const requestWithdrawalBodySchema = z.object({ provider_id: z.string().min(1), amount_kz: z.number() });

const reasonBodySchema = z.object({ reason: z.string().optional() });

const markPaidBodySchema = z.object({ payment_reference: z.string().optional() });

const transactionsQuerySchema = pageQuerySchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
});

const batchesQuerySchema = pageQuerySchema.extend({ status: z.string().optional() });

const createBatchBodySchema = z.object({ withdrawal_ids: z.array(z.string().min(1)).min(1) });

const markBatchPaidBodySchema = z.object({ bank_reference: z.string().optional() });

function pricingTotal(row: ServiceRequestRow) {
  const pricing = row.pricing as { total_kz?: number } | null;
  return pricing?.total_kz ?? 0;
}

function pricingFee(row: ServiceRequestRow) {
  const pricing = row.pricing as { platform_fee_kz?: number } | null;
  return pricing?.platform_fee_kz ?? 0;
}

function commissionOf(row: ServiceRequestRow) {
  if (row.providerEarningKz === null) return 0;
  return Math.max(0, pricingTotal(row) - pricingFee(row) - row.providerEarningKz);
}

function isSettled(row: ServiceRequestRow) {
  return (SETTLED_STATUSES as readonly string[]).includes(row.status);
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 400; ) {
    days.push(day);
    const next = new Date(`${day}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    day = dayKey(next);
  }
  return days;
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

function presentWithdrawal(row: WithdrawalRow, providerName: string) {
  return {
    id: row.id,
    provider_id: row.providerAccountId,
    provider_name: providerName,
    amount_kz: row.amountKz,
    iban: row.iban,
    status: row.status,
    requested_at: row.requestedAt.toISOString(),
    decided_at: row.decidedAt ? row.decidedAt.toISOString() : null,
    paid_at: row.paidAt ? row.paidAt.toISOString() : null,
    payment_reference: row.paymentReference,
    reason: row.reason,
    batch_id: row.batchId,
  };
}

function presentBatch(row: PayoutBatchRow, withdrawalIds: string[]) {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    withdrawal_ids: withdrawalIds,
    total_kz: row.totalKz,
    count: row.count,
    created_at: row.createdAt.toISOString(),
    sent_at: row.sentAt ? row.sentAt.toISOString() : null,
    paid_at: row.paidAt ? row.paidAt.toISOString() : null,
    bank_reference: row.bankReference,
    cancel_reason: row.cancelReason,
  };
}

async function providerNamesById(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db.select().from(accounts).where(inArray(accounts.id, ids));
  return new Map(rows.map((row) => [row.id, row.fullName]));
}

async function loadWithdrawalOrNotFound(id: string) {
  const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Levantamento não encontrado.");
  return row;
}

async function loadBatchOrNotFound(id: string) {
  const [row] = await db.select().from(payoutBatches).where(eq(payoutBatches.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Lote de pagamento não encontrado.");
  return row;
}

async function availableBalance(providerAccountId: string, exceptWithdrawalId?: string) {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, providerAccountId)).limit(1);
  const balance = wallet?.balanceKz ?? 0;
  const reservedRows = await db.select().from(withdrawals).where(eq(withdrawals.providerAccountId, providerAccountId));
  const reserved = reservedRows
    .filter((row) => row.id !== exceptWithdrawalId && (row.status === "pending" || row.status === "approved"))
    .reduce((sum, row) => sum + row.amountKz, 0);
  return balance - reserved;
}

export async function adminFinanceRoutes(app: FastifyInstance) {
  app.get("/admin/finance/revenue", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.view");
    const query = dateRangeQuerySchema.parse(request.query);
    const from = query.from.slice(0, 10);
    const to = query.to.slice(0, 10);

    const rows = await db.select().from(serviceRequests);
    const settled = rows.filter((row) => isSettled(row) && dayKey(row.createdAt) >= from && dayKey(row.createdAt) <= to);

    const byDay = daysBetween(from, to).map((date) => ({ date, fees_kz: 0, commissions_kz: 0, volume_kz: 0, count: 0 }));
    const dayIndex = new Map(byDay.map((point, index) => [point.date, index]));
    const byService = SERVICE_KINDS.map((kind) => ({ kind, fees_kz: 0, commissions_kz: 0, volume_kz: 0, count: 0 }));

    for (const row of settled) {
      const fee = pricingFee(row);
      const commission = commissionOf(row);
      const total = pricingTotal(row);
      const point = byDay[dayIndex.get(dayKey(row.createdAt)) ?? -1];
      const service = byService.find((item) => item.kind === row.serviceType);
      for (const bucket of [point, service]) {
        if (!bucket) continue;
        bucket.fees_kz += fee;
        bucket.commissions_kz += commission;
        bucket.volume_kz += total;
        bucket.count += 1;
      }
    }

    const fees = byService.reduce((sum, item) => sum + item.fees_kz, 0);
    const commissions = byService.reduce((sum, item) => sum + item.commissions_kz, 0);

    return dataEnvelope({
      from,
      to,
      by_day: byDay,
      by_service: byService,
      totals: {
        fees_kz: fees,
        commissions_kz: commissions,
        refunds_kz: 0,
        revenue_kz: fees + commissions,
        volume_kz: byService.reduce((sum, item) => sum + item.volume_kz, 0),
        count: settled.length,
      },
    });
  });

  app.get("/admin/finance/withdrawals", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.view");
    const query = withdrawalsQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status);

    const rows = await db.select().from(withdrawals);
    const names = await providerNamesById(rows.map((row) => row.providerAccountId));
    const presented = rows
      .filter((row) => !statusFilter?.length || statusFilter.includes(row.status))
      .map((row) => presentWithdrawal(row, names.get(row.providerAccountId) ?? "Prestador"))
      .filter((item) => matchesText(query.q, item.provider_name, item.iban, item.payment_reference))
      .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));

    return listPageEnvelope(paginate(presented, query));
  });

  app.post("/admin/finance/withdrawals", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.withdrawals");
    const body = requestWithdrawalBodySchema.parse(request.body);

    const [provider] = await db.select().from(providers).where(eq(providers.accountId, body.provider_id)).limit(1);
    if (!provider) throw apiError("not_found", "Prestador não encontrado.");

    if (!Number.isFinite(body.amount_kz) || body.amount_kz <= 0) {
      throw apiError("validation", "O valor do levantamento tem de ser superior a 0 Kz.", { issues: [{ field: "amount_kz", message: "O valor tem de ser superior a 0." }] });
    }
    if (body.amount_kz < MINIMUM_WITHDRAWAL_KZ) {
      throw apiError("validation", `O levantamento mínimo é de ${MINIMUM_WITHDRAWAL_KZ} Kz.`, { issues: [{ field: "amount_kz", message: "Valor abaixo do mínimo." }] });
    }

    const free = await availableBalance(body.provider_id);
    if (body.amount_kz > free) {
      throw apiError("validation", `O valor excede o saldo disponível (${Math.max(0, free)} Kz).`, { issues: [{ field: "amount_kz", message: "Saldo insuficiente." }] });
    }

    const [existingIban] = await db.select().from(withdrawals).where(eq(withdrawals.providerAccountId, body.provider_id)).limit(1);
    const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, body.provider_id)).limit(1);
    const iban = existingIban?.iban ?? wallet?.payoutAccount?.iban ?? DEFAULT_IBAN;

    const [created] = await db
      .insert(withdrawals)
      .values({ id: newId("wd"), providerAccountId: body.provider_id, amountKz: Math.round(body.amount_kz), iban, status: "pending" })
      .returning();

    const names = await providerNamesById([body.provider_id]);
    return dataEnvelope(presentWithdrawal(created!, names.get(body.provider_id) ?? "Prestador"));
  });

  app.post("/admin/finance/withdrawals/:id/approve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const { id } = request.params as { id: string };

    const withdrawal = await loadWithdrawalOrNotFound(id);
    if (withdrawal.status !== "pending") throw apiError("invalid_transition", "Só é possível aprovar levantamentos pendentes.");

    const free = await availableBalance(withdrawal.providerAccountId, withdrawal.id);
    if (withdrawal.amountKz > free) {
      throw apiError("validation", `O saldo disponível (${Math.max(0, free)} Kz) já não cobre este levantamento.`);
    }

    await db.update(withdrawals).set({ status: "approved", decidedAt: new Date(), decidedByAccountId: admin.id }).where(eq(withdrawals.id, id));

    const names = await providerNamesById([withdrawal.providerAccountId]);
    const providerName = names.get(withdrawal.providerAccountId) ?? "Prestador";
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "withdrawal.approve",
      targetModule: "withdrawal",
      targetId: id,
      targetLabel: `${providerName} — ${withdrawal.amountKz} Kz`,
      reason: "Saldo confirmado.",
      changes: [{ field: "Estado", from: "pending", to: "approved" }],
      sensitive: true,
    });

    const updated = await loadWithdrawalOrNotFound(id);
    return dataEnvelope(presentWithdrawal(updated, providerName));
  });

  app.post("/admin/finance/withdrawals/:id/reject", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da rejeição");

    const withdrawal = await loadWithdrawalOrNotFound(id);
    if (withdrawal.status !== "pending" && withdrawal.status !== "approved") {
      throw apiError("invalid_transition", "Este levantamento já foi decidido.");
    }

    await db
      .update(withdrawals)
      .set({ status: "rejected", reason, decidedAt: new Date(), decidedByAccountId: admin.id })
      .where(eq(withdrawals.id, id));

    const names = await providerNamesById([withdrawal.providerAccountId]);
    const providerName = names.get(withdrawal.providerAccountId) ?? "Prestador";
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "withdrawal.reject",
      targetModule: "withdrawal",
      targetId: id,
      targetLabel: `${providerName} — ${withdrawal.amountKz} Kz`,
      reason,
      changes: [{ field: "Estado", from: withdrawal.status, to: "rejected" }],
      sensitive: true,
    });

    const updated = await loadWithdrawalOrNotFound(id);
    return dataEnvelope(presentWithdrawal(updated, providerName));
  });

  app.post("/admin/finance/withdrawals/:id/mark-paid", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const { id } = request.params as { id: string };
    const body = markPaidBodySchema.parse(request.body);
    const reference = requireReason(body.payment_reference, "a referência da transferência");

    const withdrawal = await loadWithdrawalOrNotFound(id);
    if (withdrawal.status !== "approved") throw apiError("invalid_transition", "Só é possível marcar como pagos levantamentos aprovados.");

    const now = new Date();
    await db
      .update(withdrawals)
      .set({ status: "paid", paidAt: now, paymentReference: reference })
      .where(eq(withdrawals.id, id));

    const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, withdrawal.providerAccountId)).limit(1);
    if (wallet) {
      await db.update(wallets).set({ balanceKz: wallet.balanceKz - withdrawal.amountKz }).where(eq(wallets.providerAccountId, withdrawal.providerAccountId));
    }
    await db.insert(walletTransactions).values({
      id: newId("tx"),
      providerAccountId: withdrawal.providerAccountId,
      type: "withdrawal",
      title: `Levantamento para IBAN …${withdrawal.iban.replace(/\s/g, "").slice(-5)}`,
      amountKz: -withdrawal.amountKz,
      status: "completed",
    });

    const names = await providerNamesById([withdrawal.providerAccountId]);
    const providerName = names.get(withdrawal.providerAccountId) ?? "Prestador";
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "withdrawal.paid",
      targetModule: "withdrawal",
      targetId: id,
      targetLabel: `${providerName} — ${withdrawal.amountKz} Kz`,
      reason: `Referência ${reference}`,
      changes: [{ field: "Estado", from: "approved", to: "paid" }],
      sensitive: true,
    });

    const updated = await loadWithdrawalOrNotFound(id);
    return dataEnvelope(presentWithdrawal(updated, providerName));
  });

  app.get("/admin/finance/transactions", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.view");
    const query = transactionsQuerySchema.parse(request.query);
    const kindFilter = csvList(query.kind);
    const statusFilter = csvList(query.status);

    const rows = await db.select().from(walletTransactions);
    const names = await providerNamesById(rows.map((row) => row.providerAccountId));

    const filtered = rows
      .filter((row) => !kindFilter?.length || kindFilter.includes(row.type))
      .filter((row) => !statusFilter?.length || statusFilter.includes(row.status))
      .filter((row) => !query.from || row.createdAt >= new Date(query.from))
      .filter((row) => !query.to || row.createdAt <= new Date(query.to))
      .map((row) => ({
        id: row.id,
        kind: row.type,
        title: row.title,
        amount_kz: row.amountKz,
        at: row.createdAt.toISOString(),
        status: row.status,
        service_kind: row.serviceType,
        provider_id: row.providerAccountId,
        provider_name: names.get(row.providerAccountId) ?? "Prestador",
        request_id: row.requestId,
      }))
      .filter((item) => matchesText(query.q, item.title, item.provider_name))
      .sort((a, b) => (a.at < b.at ? 1 : -1));

    return listPageEnvelope(paginate(filtered, query));
  });

  app.get("/admin/finance/transactions/export", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.view");
    const query = transactionsQuerySchema.parse(request.query);
    const kindFilter = csvList(query.kind);
    const statusFilter = csvList(query.status);

    const rows = await db.select().from(walletTransactions);
    const names = await providerNamesById(rows.map((row) => row.providerAccountId));

    const filtered = rows
      .filter((row) => !kindFilter?.length || kindFilter.includes(row.type))
      .filter((row) => !statusFilter?.length || statusFilter.includes(row.status))
      .filter((row) => !query.from || row.createdAt >= new Date(query.from))
      .filter((row) => !query.to || row.createdAt <= new Date(query.to))
      .map((row) => ({
        id: row.id,
        kind: row.type,
        title: row.title,
        amount_kz: row.amountKz,
        at: row.createdAt.toISOString(),
        status: row.status,
        service_kind: row.serviceType,
        provider_id: row.providerAccountId,
        provider_name: names.get(row.providerAccountId) ?? "Prestador",
        request_id: row.requestId,
      }))
      .filter((item) => matchesText(query.q, item.title, item.provider_name))
      .sort((a, b) => (a.at < b.at ? 1 : -1));

    return dataEnvelope(filtered);
  });

  app.get("/admin/finance/batches", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.view");
    const query = batchesQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status);

    const rows = await db.select().from(payoutBatches);
    const withdrawalRows = await db.select().from(withdrawals);
    const presented = rows
      .filter((row) => !statusFilter?.length || statusFilter.includes(row.status))
      .map((row) => presentBatch(row, withdrawalRows.filter((item) => item.batchId === row.id).map((item) => item.id)))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return listPageEnvelope(paginate(presented, query));
  });

  app.get("/admin/finance/batches/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "finance.view");
    const { id } = request.params as { id: string };
    const batch = await loadBatchOrNotFound(id);
    const withdrawalRows = await db.select().from(withdrawals).where(eq(withdrawals.batchId, id));
    const names = await providerNamesById(withdrawalRows.map((row) => row.providerAccountId));

    return dataEnvelope({
      ...presentBatch(batch, withdrawalRows.map((row) => row.id)),
      withdrawals: withdrawalRows.map((row) => presentWithdrawal(row, names.get(row.providerAccountId) ?? "Prestador")),
    });
  });

  app.post("/admin/finance/batches", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const body = createBatchBodySchema.parse(request.body);
    const uniqueIds = [...new Set(body.withdrawal_ids)];

    const rows = await db.select().from(withdrawals).where(inArray(withdrawals.id, uniqueIds));
    if (rows.length !== uniqueIds.length) throw apiError("not_found", "Há levantamentos que não existem.");

    const openBatches = await db.select().from(payoutBatches).where(inArray(payoutBatches.status, ["draft", "sent"]));
    const openBatchIds = new Set(openBatches.map((item) => item.id));

    if (rows.some((row) => row.status !== "approved")) throw apiError("validation", "Só levantamentos aprovados entram num lote.");
    if (rows.some((row) => row.batchId && openBatchIds.has(row.batchId))) throw apiError("validation", "Há levantamentos que já estão noutro lote.");

    const existingBatches = await db.select().from(payoutBatches);
    const sequence = existingBatches.length + 1;
    const total = rows.reduce((sum, row) => sum + row.amountKz, 0);
    const batchId = newId("lp");

    const [batch] = await db
      .insert(payoutBatches)
      .values({
        id: batchId,
        code: `LP-${String(sequence).padStart(4, "0")}`,
        status: "draft",
        totalKz: total,
        count: rows.length,
        createdByAccountId: admin.id,
      })
      .returning();

    await db.update(withdrawals).set({ batchId }).where(inArray(withdrawals.id, uniqueIds));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "batch.create",
      targetModule: "batch",
      targetId: batchId,
      targetLabel: `${batch!.code} — ${total} Kz`,
      reason: `${rows.length} levantamento(s).`,
      sensitive: true,
    });

    return dataEnvelope(presentBatch(batch!, uniqueIds));
  });

  app.post("/admin/finance/batches/:id/send", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const { id } = request.params as { id: string };

    const batch = await loadBatchOrNotFound(id);
    if (batch.status !== "draft") throw apiError("invalid_transition", "Só é possível enviar um lote em preparação.");

    const withdrawalRows = await db.select().from(withdrawals).where(eq(withdrawals.batchId, id));
    if (withdrawalRows.some((row) => row.status !== "approved")) {
      throw apiError("validation", "Há levantamentos no lote que já não estão aprovados. Cancele o lote e crie outro.");
    }

    await db.update(payoutBatches).set({ status: "sent", sentAt: new Date() }).where(eq(payoutBatches.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "batch.send",
      targetModule: "batch",
      targetId: id,
      targetLabel: `${batch.code} — ${batch.totalKz} Kz`,
      reason: "Ficheiro de transferências gerado.",
      changes: [{ field: "Estado", from: "draft", to: "sent" }],
      sensitive: true,
    });

    const names = await providerNamesById(withdrawalRows.map((row) => row.providerAccountId));
    const updated = await loadBatchOrNotFound(id);
    return dataEnvelope({
      ...presentBatch(updated, withdrawalRows.map((row) => row.id)),
      withdrawals: withdrawalRows.map((row) => presentWithdrawal(row, names.get(row.providerAccountId) ?? "Prestador")),
    });
  });

  app.post("/admin/finance/batches/:id/mark-paid", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const { id } = request.params as { id: string };
    const body = markBatchPaidBodySchema.parse(request.body);
    const reference = requireReason(body.bank_reference, "a referência do banco");

    const batch = await loadBatchOrNotFound(id);
    if (batch.status !== "sent") throw apiError("invalid_transition", "Só é possível marcar como pago um lote enviado ao banco.");

    const withdrawalRows = await db.select().from(withdrawals).where(eq(withdrawals.batchId, id));
    const now = new Date();
    for (let index = 0; index < withdrawalRows.length; index += 1) {
      const row = withdrawalRows[index]!;
      if (row.status !== "approved") continue;
      await db
        .update(withdrawals)
        .set({ status: "paid", paidAt: now, paymentReference: `${reference}/${index + 1}` })
        .where(eq(withdrawals.id, row.id));
      const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, row.providerAccountId)).limit(1);
      if (wallet) {
        await db.update(wallets).set({ balanceKz: wallet.balanceKz - row.amountKz }).where(eq(wallets.providerAccountId, row.providerAccountId));
      }
      await db.insert(walletTransactions).values({
        id: newId("tx"),
        providerAccountId: row.providerAccountId,
        type: "withdrawal",
        title: `Levantamento para IBAN …${row.iban.replace(/\s/g, "").slice(-5)}`,
        amountKz: -row.amountKz,
        status: "completed",
      });
    }

    await db.update(payoutBatches).set({ status: "paid", paidAt: now, bankReference: reference }).where(eq(payoutBatches.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "batch.paid",
      targetModule: "batch",
      targetId: id,
      targetLabel: `${batch.code} — ${batch.totalKz} Kz`,
      reason: `Referência ${reference}`,
      changes: [{ field: "Estado", from: "sent", to: "paid" }],
      sensitive: true,
    });

    const updated = await loadBatchOrNotFound(id);
    return dataEnvelope(presentBatch(updated, withdrawalRows.map((row) => row.id)));
  });

  app.post("/admin/finance/batches/:id/cancel", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "finance.withdrawals");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo do cancelamento");

    const batch = await loadBatchOrNotFound(id);
    if (batch.status !== "draft" && batch.status !== "sent") throw apiError("invalid_transition", "Este lote já está fechado.");

    const withdrawalRows = await db.select().from(withdrawals).where(eq(withdrawals.batchId, id));
    if (withdrawalRows.length > 0) {
      await db.update(withdrawals).set({ batchId: null }).where(inArray(withdrawals.id, withdrawalRows.map((row) => row.id)));
    }

    await db.update(payoutBatches).set({ status: "cancelled", cancelReason: reason }).where(eq(payoutBatches.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "batch.cancel",
      targetModule: "batch",
      targetId: id,
      targetLabel: `${batch.code} — ${batch.totalKz} Kz`,
      reason,
      changes: [{ field: "Estado", from: batch.status, to: "cancelled" }],
      sensitive: true,
    });

    const updated = await loadBatchOrNotFound(id);
    return dataEnvelope(presentBatch(updated, []));
  });
}
