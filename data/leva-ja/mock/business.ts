import { formatKz, formatPercent } from "@/lib/format";
import { businessAmounts, contractIssues, monthLabel, monthOf, statementDueDate } from "@/lib/leva-ja/commerce";
import { normalizeAngolanPhone, formatAngolanPhone } from "@/lib/phone";
import type { BusinessAccount } from "@/types/leva-ja";
import type { BusinessDetail, BusinessRepository, BusinessStatementView, BusinessSummary } from "../repositories/business";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, eventAt, isSettled } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

function memberTotals(state: MockState, account: BusinessAccount) {
  const members = new Set(account.clientIds);
  const byMonth = new Map<string, number[]>();
  for (const request of state.requests) {
    if (!members.has(request.clientId) || !isSettled(request)) continue;
    const paidAt = eventAt(request, "paid") ?? request.createdAt;
    if (paidAt < account.contract.startsAt) continue;
    const month = monthOf(paidAt);
    byMonth.set(month, [...(byMonth.get(month) ?? []), request.price.total]);
  }
  return byMonth;
}

export function businessStatements(state: MockState, account: BusinessAccount, now: Date): BusinessStatementView[] {
  const current = monthOf(now.toISOString());
  const today = now.toISOString().slice(0, 10);
  const byMonth = memberTotals(state, account);
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, totals]) => {
      const stored = account.statements.find((statement) => statement.month === month);
      const dueDate = statementDueDate(month, account.contract.paymentTermsDays);
      const status = stored?.paidAt ? "paid" : month === current ? "open" : dueDate < today ? "overdue" : "due";
      return { month, dueDate, status, paidAt: stored?.paidAt, reference: stored?.reference, ...businessAmounts(totals, account.contract.discountRate) };
    });
}

export function businessSummary(state: MockState, account: BusinessAccount, now: Date): BusinessSummary {
  const statements = businessStatements(state, account, now);
  const current = monthOf(now.toISOString());
  const unpaid = statements.filter((statement) => statement.status !== "paid");
  const outstanding = unpaid.filter((statement) => statement.month !== current).reduce((sum, statement) => sum + statement.net, 0);
  const currentMonth = statements.find((statement) => statement.month === current) ?? { gross: 0, discount: 0, net: 0, count: 0 };
  const creditUsed = unpaid.reduce((sum, statement) => sum + statement.net, 0);
  const { statements: _statements, ...rest } = account;
  void _statements;
  return {
    ...rest,
    members: account.clientIds.length,
    currentMonth: { gross: currentMonth.gross, discount: currentMonth.discount, net: currentMonth.net, count: currentMonth.count },
    outstanding,
    overdue: unpaid.filter((statement) => statement.status === "overdue").reduce((sum, statement) => sum + statement.net, 0),
    creditUsed,
    overLimit: creditUsed > account.contract.creditLimit,
  };
}

export function createMockBusiness(db: MockDatabase): BusinessRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.businessAccounts, id, "Conta empresarial");
  const detail = (ctx: MockContext, account: BusinessAccount): BusinessDetail => {
    const since = new Date(ctx.now.getTime() - 30 * DAY).toISOString();
    return {
      ...businessSummary(ctx.state, account, ctx.now),
      statements: businessStatements(ctx.state, account, ctx.now),
      memberClients: account.clientIds.flatMap((clientId) => {
        const client = ctx.state.clients.find((item) => item.id === clientId);
        if (!client) return [];
        return [{ id: client.id, name: client.name, phone: client.phone, requests30: ctx.state.requests.filter((request) => request.clientId === client.id && request.createdAt >= since).length }];
      }),
    };
  };
  const label = (account: BusinessAccount) => account.name;
  const memberOf = (ctx: MockContext, clientId: string) => ctx.state.businessAccounts.find((account) => account.clientIds.includes(clientId));

  return {
    list: (filters = {}) =>
      db.run({ permission: "business.view" }, (ctx) =>
        paginate(
          ctx.state.businessAccounts
            .filter((account) => (!filters.status?.length || filters.status.includes(account.status)) && matchesQuery(filters.q, account.name, account.nif, account.contactName, account.sector))
            .sort(byNewest((account) => account.createdAt))
            .map((account) => businessSummary(ctx.state, account, ctx.now)),
          filters,
        ),
      ),

    get: (id) => db.run({ permission: "business.view" }, (ctx) => detail(ctx, find(ctx, id))),

    candidates: () =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const taken = new Set(ctx.state.businessAccounts.flatMap((account) => account.clientIds));
        return ctx.state.clients
          .filter((client) => !client.blocked && !taken.has(client.id))
          .map((client) => ({ id: client.id, name: client.name, phone: client.phone, requests30: 0 }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),

    create: (input) =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const issues = [
          ...(input.name.trim().length < 2 ? [{ field: "name", message: "Indique o nome da empresa." }] : []),
          ...(!/^\d{9,14}$/.test(input.nif.trim()) ? [{ field: "nif", message: "O NIF tem entre 9 e 14 dígitos." }] : []),
          ...(input.contactName.trim().length < 2 ? [{ field: "contactName", message: "Indique o responsável." }] : []),
          ...(!normalizeAngolanPhone(input.phone) ? [{ field: "phone", message: "Indique um telefone de Angola (+244 9XX XXX XXX)." }] : []),
          ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ? [{ field: "email", message: "Indique um e-mail válido." }] : []),
          ...contractIssues(input.contract),
        ];
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        if (ctx.state.businessAccounts.some((account) => account.nif === input.nif.trim())) {
          throw new RepositoryError("validation", "Já existe uma conta empresarial com este NIF.", [{ field: "nif", message: "NIF já registado." }]);
        }
        const account: BusinessAccount = {
          id: db.nextId("emp"),
          name: input.name.trim(),
          nif: input.nif.trim(),
          sector: input.sector.trim() || "Outro",
          contactName: input.contactName.trim(),
          phone: formatAngolanPhone(normalizeAngolanPhone(input.phone) ?? ""),
          email: input.email.trim().toLowerCase(),
          status: "active",
          contract: { ...input.contract },
          clientIds: [],
          statements: [],
          createdAt: ctx.nowIso,
        };
        ctx.state.businessAccounts.push(account);
        db.audit(ctx, "business.create", { kind: "business", id: account.id, label: label(account) }, `NIF ${account.nif}`);
        db.commit("finance");
        return account;
      }),

    updateContract: (id, contract, reason) =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const account = find(ctx, id);
        const issues = contractIssues(contract);
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const why = requireReason(reason, "o motivo da alteração");
        const before = account.contract;
        const changes = [
          before.discountRate !== contract.discountRate && { field: "Desconto", from: formatPercent(before.discountRate * 100), to: formatPercent(contract.discountRate * 100) },
          before.paymentTermsDays !== contract.paymentTermsDays && { field: "Prazo de pagamento", from: `${before.paymentTermsDays} dias`, to: `${contract.paymentTermsDays} dias` },
          before.creditLimit !== contract.creditLimit && { field: "Limite de crédito", from: formatKz(before.creditLimit), to: formatKz(contract.creditLimit) },
          before.endsAt !== contract.endsAt && { field: "Fim do contrato", from: before.endsAt.slice(0, 10), to: contract.endsAt.slice(0, 10) },
        ].filter((change): change is { field: string; from: string; to: string } => Boolean(change));
        if (changes.length === 0 && before.startsAt === contract.startsAt) throw new RepositoryError("validation", "Não há alterações para guardar.");
        account.contract = { ...contract };
        db.audit(ctx, "business.contract", { kind: "business", id, label: label(account) }, why, changes);
        db.commit("finance");
        return detail(ctx, account);
      }),

    addMember: (id, clientId) =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const account = find(ctx, id);
        if (account.status !== "active") throw new RepositoryError("invalid_transition", "A conta empresarial está suspensa.");
        const client = findOr404(ctx.state.clients, clientId, "Cliente");
        const other = memberOf(ctx, clientId);
        if (other) throw new RepositoryError("validation", other.id === id ? "O cliente já pertence a esta empresa." : `O cliente já pertence à empresa ${other.name}.`);
        account.clientIds.push(clientId);
        db.audit(ctx, "business.member_add", { kind: "business", id, label: label(account) }, undefined, [{ field: "Utilizador", from: "—", to: client.name }]);
        db.commit("finance");
        return detail(ctx, account);
      }),

    removeMember: (id, clientId, reason) =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const account = find(ctx, id);
        if (!account.clientIds.includes(clientId)) throw new RepositoryError("validation", "O cliente não pertence a esta empresa.");
        const why = requireReason(reason, "o motivo");
        const client = ctx.state.clients.find((item) => item.id === clientId);
        account.clientIds = account.clientIds.filter((item) => item !== clientId);
        db.audit(ctx, "business.member_remove", { kind: "business", id, label: label(account) }, why, [{ field: "Utilizador", from: client?.name ?? clientId, to: "—" }]);
        db.commit("finance");
        return detail(ctx, account);
      }),

    markStatementPaid: (id, month, reference) =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const account = find(ctx, id);
        const statement = businessStatements(ctx.state, account, ctx.now).find((item) => item.month === month);
        if (!statement) throw new RepositoryError("not_found", "Extracto não encontrado.");
        if (statement.status === "paid") throw new RepositoryError("invalid_transition", "Este extracto já está pago.");
        if (statement.status === "open") throw new RepositoryError("invalid_transition", "O mês ainda não fechou.");
        const ref = requireReason(reference, "a referência do pagamento");
        account.statements = [...account.statements.filter((item) => item.month !== month), { month, paidAt: ctx.nowIso, reference: ref }];
        db.audit(ctx, "business.statement_paid", { kind: "business", id, label: label(account) }, `Referência ${ref}`, [
          { field: monthLabel(month), from: formatKz(statement.net), to: "Pago" },
        ]);
        db.commit("finance");
        return detail(ctx, account);
      }),

    setStatus: (id, status, reason) =>
      db.run({ permission: "business.manage" }, (ctx) => {
        const account = find(ctx, id);
        if (account.status === status) throw new RepositoryError("invalid_transition", status === "active" ? "A conta já está activa." : "A conta já está suspensa.");
        const why = requireReason(reason, "o motivo");
        account.status = status;
        account.suspensionReason = status === "suspended" ? why : undefined;
        db.audit(ctx, status === "suspended" ? "business.suspend" : "business.reactivate", { kind: "business", id, label: label(account) }, why, [
          { field: "Estado", from: status === "suspended" ? "Activa" : "Suspensa", to: status === "suspended" ? "Suspensa" : "Activa" },
        ]);
        db.commit("finance");
        return detail(ctx, account);
      }),
  };
}
