import { formatKz, luandaDay } from "@/lib/format";
import { SERVICE_KINDS, WITHDRAWAL_STATUS_LABELS } from "@/lib/leva-ja/services";
import { BATCH_STATUS_LABELS, batchIssues } from "@/lib/leva-ja/billing";
import type { PayoutBatch, Withdrawal } from "@/types/leva-ja";
import type { FinanceRepository, PayoutBatchDetail, RevenueReport, TransactionFilters } from "../repositories/finance";
import type { DateRange } from "../repositories/common";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { addDays, commissionOf, isSettled, payWithdrawal, providerBalance, reservedWithdrawals } from "./domain";
import { byNewest, findOr404, inRange, matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 400; day = addDays(day, 1)) days.push(day);
  return days;
}

export function revenueReport(state: MockState, range: Required<DateRange>): RevenueReport {
  const from = range.from.slice(0, 10);
  const to = range.to.slice(0, 10);
  const settled = state.requests.filter((request) => isSettled(request) && inRange(request.createdAt, { from, to }));
  const byDay = daysBetween(from, to).map((date) => ({ date, fees: 0, commissions: 0, volume: 0, count: 0 }));
  const dayIndex = new Map(byDay.map((point, index) => [point.date, index]));
  const byService = SERVICE_KINDS.map((kind) => ({ kind, fees: 0, commissions: 0, volume: 0, count: 0 }));
  for (const request of settled) {
    const commission = commissionOf(request);
    const point = byDay[dayIndex.get(luandaDay(request.createdAt)) ?? -1];
    const service = byService.find((item) => item.kind === request.kind);
    for (const bucket of [point, service]) {
      if (!bucket) continue;
      bucket.fees += request.price.platformFee;
      bucket.commissions += commission;
      bucket.volume += request.price.total;
      bucket.count += 1;
    }
  }
  const fees = byService.reduce((sum, item) => sum + item.fees, 0);
  const commissions = byService.reduce((sum, item) => sum + item.commissions, 0);
  const refunds = state.refunds
    .filter((refund) => refund.status === "paid" && !refund.chargeProvider && refund.paidAt && inRange(refund.paidAt, { from, to }))
    .reduce((sum, refund) => sum + refund.amount, 0);
  return {
    from,
    to,
    byDay,
    byService,
    totals: {
      fees,
      commissions,
      refunds,
      revenue: fees + commissions - refunds,
      volume: byService.reduce((sum, item) => sum + item.volume, 0),
      count: settled.length,
    },
  };
}

function filterTransactions(ctx: MockContext, filters: Omit<TransactionFilters, "page" | "pageSize"> = {}) {
  return ctx.state.transactions
    .filter((transaction) => {
      if (filters.kind?.length && !filters.kind.includes(transaction.kind)) return false;
      if (filters.status?.length && !filters.status.includes(transaction.status)) return false;
      if (!inRange(transaction.at, filters)) return false;
      return matchesQuery(filters.q, transaction.title, transaction.providerName);
    })
    .sort(byNewest((transaction) => transaction.at));
}

function available(state: MockState, providerId: string, exceptId?: string) {
  return providerBalance(state, providerId) - reservedWithdrawals(state, providerId, exceptId);
}

function findBatch(state: MockState, id: string) {
  const batch = state.payoutBatches.find((item) => item.id === id);
  if (!batch) throw new RepositoryError("not_found", "Lote de pagamento não encontrado.");
  return batch;
}

function batchDetail(state: MockState, batch: PayoutBatch): PayoutBatchDetail {
  return { ...batch, withdrawals: batch.withdrawalIds.flatMap((id) => state.withdrawals.filter((withdrawal) => withdrawal.id === id)) };
}

export function createMockFinance(db: MockDatabase): FinanceRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.withdrawals, id, "Levantamento");
  const label = (withdrawal: Withdrawal) => `${withdrawal.providerName} — ${formatKz(withdrawal.amount)}`;
  const transition = (withdrawal: Withdrawal, next: Withdrawal["status"]) => ({
    field: "Estado",
    from: WITHDRAWAL_STATUS_LABELS[withdrawal.status],
    to: WITHDRAWAL_STATUS_LABELS[next],
  });

  return {
    revenue: (range) => db.run({ permission: "finance.view" }, ({ state }) => revenueReport(state, range)),

    withdrawals: (filters = {}) =>
      db.run({ permission: "finance.view" }, ({ state }) => {
        const items = state.withdrawals
          .filter((withdrawal) => !filters.status?.length || filters.status.includes(withdrawal.status))
          .filter((withdrawal) => matchesQuery(filters.q, withdrawal.providerName, withdrawal.iban, withdrawal.paymentReference))
          .sort(byNewest((withdrawal) => withdrawal.requestedAt));
        return paginate(items, filters);
      }),

    requestWithdrawal: (providerId, amount) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const provider = findOr404(ctx.state.providers, providerId, "Prestador");
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new RepositoryError("validation", "O valor do levantamento tem de ser superior a 0 Kz.", [
            { field: "amount", message: "O valor do levantamento tem de ser superior a 0 Kz." },
          ]);
        }
        const minimum = ctx.state.settings.payouts.minimumWithdrawal;
        if (amount < minimum) {
          throw new RepositoryError("validation", `O levantamento mínimo é de ${formatKz(minimum)}.`, [
            { field: "amount", message: `O levantamento mínimo é de ${formatKz(minimum)}.` },
          ]);
        }
        const free = available(ctx.state, providerId);
        if (amount > free) {
          throw new RepositoryError("validation", `O valor excede o saldo disponível (${formatKz(Math.max(0, free))}).`, [
            { field: "amount", message: "O valor excede o saldo disponível." },
          ]);
        }
        const withdrawal: Withdrawal = {
          id: db.nextId("wd"),
          providerId,
          providerName: provider.name,
          amount: Math.round(amount),
          iban: ctx.state.withdrawals.find((item) => item.providerId === providerId)?.iban ?? "AO06 0000 0000 0000 0000 0000 0",
          status: "pending",
          requestedAt: ctx.nowIso,
        };
        ctx.state.withdrawals.push(withdrawal);
        db.commit("finance");
        return withdrawal;
      }),

    approveWithdrawal: (id) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const withdrawal = find(ctx, id);
        if (withdrawal.status !== "pending") {
          throw new RepositoryError("invalid_transition", "Só é possível aprovar levantamentos pendentes.");
        }
        const free = available(ctx.state, withdrawal.providerId, withdrawal.id);
        if (withdrawal.amount > free) {
          throw new RepositoryError("validation", `O saldo disponível (${formatKz(Math.max(0, free))}) já não cobre este levantamento.`);
        }
        const change = transition(withdrawal, "approved");
        withdrawal.status = "approved";
        withdrawal.decidedAt = ctx.nowIso;
        withdrawal.decidedBy = ctx.session.user.name;
        db.audit(ctx, "withdrawal.approve", { kind: "withdrawal", id: withdrawal.id, label: label(withdrawal) }, "Saldo confirmado.", [change]);
        db.commit("finance");
        return withdrawal;
      }),

    rejectWithdrawal: (id, reason) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const withdrawal = find(ctx, id);
        if (withdrawal.status !== "pending" && withdrawal.status !== "approved") {
          throw new RepositoryError("invalid_transition", "Este levantamento já foi decidido.");
        }
        const why = requireReason(reason, "o motivo da rejeição");
        const change = transition(withdrawal, "rejected");
        withdrawal.status = "rejected";
        withdrawal.reason = why;
        withdrawal.decidedAt = ctx.nowIso;
        withdrawal.decidedBy = ctx.session.user.name;
        db.audit(ctx, "withdrawal.reject", { kind: "withdrawal", id: withdrawal.id, label: label(withdrawal) }, why, [change]);
        db.commit("finance");
        return withdrawal;
      }),

    markWithdrawalPaid: (id, paymentReference) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const withdrawal = find(ctx, id);
        if (withdrawal.status !== "approved") {
          throw new RepositoryError("invalid_transition", "Só é possível marcar como pagos levantamentos aprovados.");
        }
        const reference = requireReason(paymentReference, "a referência da transferência");
        const change = transition(withdrawal, "paid");
        payWithdrawal(ctx.state, withdrawal, reference, ctx.nowIso);
        db.audit(ctx, "withdrawal.paid", { kind: "withdrawal", id: withdrawal.id, label: label(withdrawal) }, `Referência ${reference}`, [change]);
        db.commit("finance", "providers");
        return withdrawal;
      }),

    transactions: (filters = {}) =>
      db.run({ permission: "finance.view" }, (ctx) => paginate(filterTransactions(ctx, filters), filters)),

    exportTransactions: (filters = {}) => db.run({ permission: "finance.view" }, (ctx) => filterTransactions(ctx, filters)),

    batches: (filters = {}) =>
      db.run({ permission: "finance.view" }, ({ state }) =>
        paginate(
          state.payoutBatches.filter((batch) => !filters.status?.length || filters.status.includes(batch.status)).sort(byNewest((batch) => batch.createdAt)),
          filters,
        ),
      ),

    batch: (id) => db.run({ permission: "finance.view" }, ({ state }) => batchDetail(state, findBatch(state, id))),

    createBatch: (withdrawalIds) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const unique = [...new Set(withdrawalIds)];
        const withdrawals = unique.map((id) => find(ctx, id));
        const open = new Set(ctx.state.payoutBatches.filter((batch) => batch.status === "draft" || batch.status === "sent").map((batch) => batch.id));
        const issue = batchIssues(withdrawals, open);
        if (issue) throw new RepositoryError("validation", issue);
        const sequence = ctx.state.payoutBatches.length + 1;
        const batch: PayoutBatch = {
          id: db.nextId("lp"),
          code: `LP-${String(sequence).padStart(4, "0")}`,
          status: "draft",
          withdrawalIds: unique,
          total: withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0),
          count: withdrawals.length,
          createdAt: ctx.nowIso,
          createdBy: ctx.session.user.name,
        };
        for (const withdrawal of withdrawals) withdrawal.batchId = batch.id;
        ctx.state.payoutBatches.push(batch);
        db.audit(ctx, "batch.create", { kind: "batch", id: batch.id, label: `${batch.code} — ${formatKz(batch.total)}` }, `${batch.count} levantamento(s).`);
        db.commit("finance");
        return batch;
      }),

    sendBatch: (id) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const batch = findBatch(ctx.state, id);
        if (batch.status !== "draft") throw new RepositoryError("invalid_transition", `Só é possível enviar um lote em preparação (está «${BATCH_STATUS_LABELS[batch.status]}»).`);
        const detail = batchDetail(ctx.state, batch);
        if (detail.withdrawals.some((withdrawal) => withdrawal.status !== "approved")) {
          throw new RepositoryError("validation", "Há levantamentos no lote que já não estão aprovados. Cancele o lote e crie outro.");
        }
        batch.status = "sent";
        batch.sentAt = ctx.nowIso;
        db.audit(ctx, "batch.send", { kind: "batch", id: batch.id, label: `${batch.code} — ${formatKz(batch.total)}` }, "Ficheiro de transferências gerado.", [
          { field: "Estado", from: BATCH_STATUS_LABELS.draft, to: BATCH_STATUS_LABELS.sent },
        ]);
        db.commit("finance");
        return batchDetail(ctx.state, batch);
      }),

    markBatchPaid: (id, bankReference) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const batch = findBatch(ctx.state, id);
        if (batch.status !== "sent") throw new RepositoryError("invalid_transition", "Só é possível marcar como pago um lote enviado ao banco.");
        const reference = requireReason(bankReference, "a referência do banco");
        batchDetail(ctx.state, batch).withdrawals.forEach((withdrawal, index) => {
          const stored = find(ctx, withdrawal.id);
          if (stored.status === "approved") payWithdrawal(ctx.state, stored, `${reference}/${index + 1}`, ctx.nowIso);
        });
        batch.status = "paid";
        batch.paidAt = ctx.nowIso;
        batch.bankReference = reference;
        db.audit(ctx, "batch.paid", { kind: "batch", id: batch.id, label: `${batch.code} — ${formatKz(batch.total)}` }, `Referência ${reference}`, [
          { field: "Estado", from: BATCH_STATUS_LABELS.sent, to: BATCH_STATUS_LABELS.paid },
        ]);
        db.commit("finance", "providers");
        return batch;
      }),

    cancelBatch: (id, reason) =>
      db.run({ permission: "finance.withdrawals" }, (ctx) => {
        const batch = findBatch(ctx.state, id);
        if (batch.status !== "draft" && batch.status !== "sent") throw new RepositoryError("invalid_transition", "Este lote já está fechado.");
        const why = requireReason(reason, "o motivo do cancelamento");
        const from = BATCH_STATUS_LABELS[batch.status];
        for (const withdrawal of ctx.state.withdrawals) if (withdrawal.batchId === batch.id) withdrawal.batchId = undefined;
        batch.status = "cancelled";
        batch.cancelReason = why;
        db.audit(ctx, "batch.cancel", { kind: "batch", id: batch.id, label: `${batch.code} — ${formatKz(batch.total)}` }, why, [
          { field: "Estado", from, to: BATCH_STATUS_LABELS.cancelled },
        ]);
        db.commit("finance");
        return batch;
      }),
  };
}
