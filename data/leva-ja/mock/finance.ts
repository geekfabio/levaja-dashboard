import { formatKz, luandaDay } from "@/lib/format";
import { SERVICE_KINDS, WITHDRAWAL_STATUS_LABELS } from "@/lib/leva-ja/services";
import type { Withdrawal } from "@/types/leva-ja";
import type { FinanceRepository, RevenueReport, TransactionFilters } from "../repositories/finance";
import type { DateRange } from "../repositories/common";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { addDays, commissionOf, isSettled, providerBalance, reservedWithdrawals } from "./domain";
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
        withdrawal.status = "paid";
        withdrawal.paidAt = ctx.nowIso;
        withdrawal.paymentReference = reference;
        ctx.state.transactions.push({
          id: `tx-${withdrawal.id}`,
          kind: "withdrawal",
          title: `Levantamento para IBAN …${withdrawal.iban.replace(/\s/g, "").slice(-5)}`,
          amount: -withdrawal.amount,
          at: ctx.nowIso,
          status: "completed",
          providerId: withdrawal.providerId,
          providerName: withdrawal.providerName,
        });
        db.audit(ctx, "withdrawal.paid", { kind: "withdrawal", id: withdrawal.id, label: label(withdrawal) }, `Referência ${reference}`, [change]);
        db.commit("finance", "providers");
        return withdrawal;
      }),

    transactions: (filters = {}) =>
      db.run({ permission: "finance.view" }, (ctx) => paginate(filterTransactions(ctx, filters), filters)),

    exportTransactions: (filters = {}) => db.run({ permission: "finance.view" }, (ctx) => filterTransactions(ctx, filters)),
  };
}
