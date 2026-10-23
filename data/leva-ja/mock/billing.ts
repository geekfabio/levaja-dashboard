import { formatKz, luandaDay } from "@/lib/format";
import { SETTLEMENT_STATUS_LABELS, buildInvoices, cashPosition, settlementStatus } from "@/lib/leva-ja/billing";
import type { CashDebt, CashDeposit, Invoice, Settlement, SettlementMethod } from "@/types/leva-ja";
import type { BillingRepository, InvoiceFilters, SettlementFilters } from "../repositories/billing";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { commissionOf, eventAt, isSettled } from "./domain";
import { daysBetween } from "./finance";
import { byNewest, findOr404, inRange, matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState, StoredSettlement } from "./state";

export const SETTLEMENT_METHODS: readonly SettlementMethod[] = ["card", "bank_reference"];

export function computeInvoices(state: MockState): Invoice[] {
  const requests = state.requests.filter(isSettled).flatMap((request) => {
    const paidAt = eventAt(request, "paid");
    if (!paidAt) return [];
    const client = state.clients.find((item) => item.id === request.clientId);
    const provider = state.providers.find((item) => item.id === request.providerId);
    return [
      {
        id: request.id,
        code: request.code,
        kind: request.kind,
        paidAt,
        total: request.price.total,
        platformFee: request.price.platformFee,
        paymentMethod: request.paymentMethod ?? "card",
        clientId: request.clientId,
        clientName: client?.name ?? "Cliente",
        clientPhone: client?.phone ?? "",
        providerName: provider?.name,
      },
    ];
  });
  const refunds = state.refunds.flatMap((refund) =>
    refund.status === "paid" && refund.paidAt ? [{ id: refund.id, requestId: refund.requestId, amount: refund.amount, paidAt: refund.paidAt, reason: refund.reason }] : [],
  );
  return buildInvoices(requests, refunds, state.settings.tax);
}

function filterInvoices(state: MockState, filters: Omit<InvoiceFilters, "page" | "pageSize"> = {}) {
  return computeInvoices(state)
    .filter((invoice) => {
      if (filters.kind?.length && !filters.kind.includes(invoice.kind)) return false;
      if (filters.method?.length && !filters.method.includes(invoice.paymentMethod)) return false;
      if (!inRange(invoice.issuedAt, filters)) return false;
      return matchesQuery(filters.q, invoice.number, invoice.requestCode, invoice.clientName, invoice.clientPhone);
    })
    .sort(byNewest((invoice) => invoice.issuedAt));
}

export function expectedSettlements(state: MockState, from: string, to: string) {
  const totals = new Map<string, { expected: number; count: number }>();
  for (const request of state.requests) {
    if (!isSettled(request) || (request.paymentMethod !== "card" && request.paymentMethod !== "bank_reference")) continue;
    const paidAt = eventAt(request, "paid");
    if (!paidAt) continue;
    const day = luandaDay(paidAt);
    if (day < from || day > to) continue;
    const key = `${day}:${request.paymentMethod}`;
    const entry = totals.get(key) ?? { expected: 0, count: 0 };
    entry.expected += request.price.total;
    entry.count += 1;
    totals.set(key, entry);
  }
  return totals;
}

export function settlementId(day: string, method: SettlementMethod) {
  return `st-${day}-${method}`;
}

function toSettlement(stored: StoredSettlement | undefined, day: string, method: SettlementMethod, expected: { expected: number; count: number }): Settlement {
  const base = stored ?? { id: settlementId(day, method), day, method, received: null };
  return {
    ...base,
    expected: expected.expected,
    count: expected.count,
    status: settlementStatus(expected.expected, base.received, Boolean(base.resolvedAt)),
  };
}

function settlementsIn(state: MockState, from: string, to: string) {
  const expected = expectedSettlements(state, from, to);
  const items: Settlement[] = [];
  for (const day of daysBetween(from, to)) {
    for (const method of SETTLEMENT_METHODS) {
      const totals = expected.get(`${day}:${method}`) ?? { expected: 0, count: 0 };
      const stored = state.settlements.find((item) => item.day === day && item.method === method);
      if (totals.expected === 0 && !stored) continue;
      items.push(toSettlement(stored, day, method, totals));
    }
  }
  return items.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.method < b.method ? -1 : 1));
}

function findSettlement(ctx: MockContext, id: string) {
  const match = /^st-(\d{4}-\d{2}-\d{2})-(card|bank_reference)$/.exec(id);
  if (!match) throw new RepositoryError("not_found", "Registo de reconciliação não encontrado.");
  const [, day, method] = match as unknown as [string, string, SettlementMethod];
  if (day > ctx.today) throw new RepositoryError("validation", "Não é possível conciliar um dia futuro.");
  let stored = ctx.state.settlements.find((item) => item.id === id);
  if (!stored) {
    stored = { id, day, method, received: null };
    ctx.state.settlements.push(stored);
  }
  const totals = expectedSettlements(ctx.state, day, day).get(`${day}:${method}`) ?? { expected: 0, count: 0 };
  return { stored, settlement: () => toSettlement(stored, day, method, totals) };
}

export function cashCharges(state: MockState, providerId: string) {
  return state.requests
    .filter((request) => request.providerId === providerId && request.paymentMethod === "cash" && isSettled(request))
    .map((request) => ({ at: eventAt(request, "paid") ?? request.createdAt, amount: request.price.platformFee + commissionOf(request) }));
}

export function cashDebtOf(state: MockState, providerId: string, now: number): CashDebt {
  const provider = findOr404(state.providers, providerId, "Prestador");
  const charges = cashCharges(state, providerId);
  const deposits = state.cashDeposits.filter((deposit) => deposit.providerId === providerId);
  return {
    providerId,
    providerName: provider.name,
    providerPhone: provider.phone,
    cashRequests: charges.length,
    ...cashPosition(charges, deposits, state.settings.payouts.cashSettlementDays, now),
  };
}

export function createMockBilling(db: MockDatabase): BillingRepository {
  const settlementLabel = (settlement: Pick<Settlement, "day" | "method">) => `${settlement.day} · ${settlement.method === "card" ? "Cartão" : "Multicaixa"}`;

  return {
    invoices: (filters = {}) =>
      db.run({ permission: "billing.view" }, ({ state }) => {
        const items = filterInvoices(state, filters);
        const invoices = items.filter((invoice) => invoice.kind === "invoice");
        const credits = items.filter((invoice) => invoice.kind === "credit_note");
        return {
          ...paginate(items, filters),
          totals: {
            invoiced: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
            credited: -credits.reduce((sum, invoice) => sum + invoice.total, 0),
            vat: items.reduce((sum, invoice) => sum + invoice.vat, 0),
            count: items.length,
          },
        };
      }),

    exportInvoices: (filters = {}) => db.run({ permission: "billing.view" }, ({ state }) => filterInvoices(state, filters)),

    invoice: (id) =>
      db.run({ permission: "billing.view" }, ({ state }) => {
        const invoice = computeInvoices(state).find((item) => item.id === id);
        if (!invoice) throw new RepositoryError("not_found", "Documento não encontrado.");
        return invoice;
      }),

    settlements: (filters: SettlementFilters) =>
      db.run({ permission: "billing.view" }, ({ state }) => {
        const items = settlementsIn(state, filters.from.slice(0, 10), filters.to.slice(0, 10)).filter((item) => {
          if (filters.method?.length && !filters.method.includes(item.method)) return false;
          return !filters.status?.length || filters.status.includes(item.status);
        });
        const received = items.reduce((sum, item) => sum + (item.received ?? 0), 0);
        const expected = items.filter((item) => item.received !== null).reduce((sum, item) => sum + item.expected, 0);
        return {
          items,
          totals: {
            expected: items.reduce((sum, item) => sum + item.expected, 0),
            received,
            difference: received - expected,
            open: items.filter((item) => item.status === "pending" || item.status === "mismatch").length,
          },
        };
      }),

    registerSettlement: (id, amount, reference) =>
      db.run({ permission: "billing.manage" }, (ctx) => {
        const { stored, settlement } = findSettlement(ctx, id);
        if (stored.received !== null) throw new RepositoryError("invalid_transition", "Este recebimento já foi registado.");
        if (!Number.isInteger(amount) || amount < 0) {
          throw new RepositoryError("validation", "Indique o valor recebido em kwanzas inteiros.", [{ field: "amount", message: "Indique o valor recebido." }]);
        }
        const ref = requireReason(reference, "a referência do extracto");
        stored.received = amount;
        stored.reference = ref;
        stored.receivedAt = ctx.nowIso;
        const result = settlement();
        db.audit(ctx, "settlement.register", { kind: "settlement", id, label: settlementLabel(result) }, `Referência ${ref}`, [
          { field: "Recebido", from: "—", to: formatKz(amount) },
          { field: "Estado", from: SETTLEMENT_STATUS_LABELS.pending, to: SETTLEMENT_STATUS_LABELS[result.status] },
        ]);
        db.commit("finance");
        return result;
      }),

    resolveSettlement: (id, resolution) =>
      db.run({ permission: "billing.manage" }, (ctx) => {
        const { stored, settlement } = findSettlement(ctx, id);
        const current = settlement();
        if (current.status !== "mismatch") throw new RepositoryError("invalid_transition", "Só é possível justificar dias com diferença.");
        const why = requireReason(resolution, "a justificação da diferença");
        stored.resolution = why;
        stored.resolvedAt = ctx.nowIso;
        stored.resolvedBy = ctx.session.user.name;
        const result = settlement();
        db.audit(ctx, "settlement.resolve", { kind: "settlement", id, label: settlementLabel(result) }, why, [
          { field: "Diferença", from: formatKz((current.received ?? 0) - current.expected), to: "Justificada" },
        ]);
        db.commit("finance");
        return result;
      }),

    cashDebts: (filters = {}) =>
      db.run({ permission: "billing.view" }, ({ state, now }) => {
        const all = state.providers
          .filter((provider) => cashCharges(state, provider.id).length > 0)
          .map((provider) => cashDebtOf(state, provider.id, now.getTime()));
        const items = all
          .filter((debt) => {
            if ((filters.state ?? "owing") === "owing" && debt.balance <= 0) return false;
            if (filters.state === "overdue" && !debt.overdue) return false;
            return matchesQuery(filters.q, debt.providerName, debt.providerPhone);
          })
          .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.balance - a.balance);
        return {
          ...paginate(items, filters),
          totals: {
            balance: all.reduce((sum, debt) => sum + Math.max(0, debt.balance), 0),
            overdueProviders: all.filter((debt) => debt.overdue).length,
            owingProviders: all.filter((debt) => debt.balance > 0).length,
          },
        };
      }),

    cashDeposits: (providerId) =>
      db.run({ permission: "billing.view" }, ({ state }) =>
        state.cashDeposits.filter((deposit) => deposit.providerId === providerId).sort(byNewest((deposit) => deposit.at)),
      ),

    registerCashDeposit: (providerId, amount, reference) =>
      db.run({ permission: "billing.manage" }, (ctx) => {
        const debt = cashDebtOf(ctx.state, providerId, ctx.now.getTime());
        if (!Number.isInteger(amount) || amount <= 0) {
          throw new RepositoryError("validation", "Indique um valor inteiro maior que zero.", [{ field: "amount", message: "Indique o valor entregue." }]);
        }
        if (amount > debt.balance) {
          throw new RepositoryError("validation", `O valor passa a dívida actual (${formatKz(Math.max(0, debt.balance))}).`, [
            { field: "amount", message: "O valor passa a dívida actual." },
          ]);
        }
        const ref = requireReason(reference, "a referência do depósito");
        const deposit: CashDeposit = {
          id: db.nextId("cd"),
          providerId,
          providerName: debt.providerName,
          amount,
          reference: ref,
          at: ctx.nowIso,
          recordedBy: ctx.session.user.name,
        };
        ctx.state.cashDeposits.push(deposit);
        db.audit(ctx, "cash.deposit", { kind: "cash", id: deposit.id, label: `${debt.providerName} — ${formatKz(amount)}` }, `Referência ${ref}`, [
          { field: "Dívida de numerário", from: formatKz(debt.balance), to: formatKz(debt.balance - amount) },
        ]);
        db.commit("finance", "providers");
        return deposit;
      }),
  };
}
