import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { businessAccounts, businessMembers, businessStatements } from "../db/schema/business";
import { clients, serviceRequestEvents, serviceRequests } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type BusinessRow = typeof businessAccounts.$inferSelect;
type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const BUSINESS_STATUSES = ["active", "suspended"] as const;
const PAYMENT_TERMS = [15, 30, 45, 60] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const contractSchema = z.object({
  starts_at: z.string(),
  ends_at: z.string(),
  discount_rate: z.number(),
  payment_terms_days: z.number(),
  credit_limit_kz: z.number(),
});

const createBodySchema = z.object({
  name: z.string(),
  nif: z.string(),
  sector: z.string().optional(),
  contact_name: z.string(),
  phone: z.string(),
  email: z.string(),
  contract: contractSchema,
});

const updateContractBodySchema = z.object({ contract: contractSchema, reason: z.string().optional() });
const addMemberBodySchema = z.object({ client_id: z.string() });
const removeMemberBodySchema = z.object({ reason: z.string().optional() });
const markPaidBodySchema = z.object({ reference: z.string().optional() });
const statusReasonBodySchema = z.object({ reason: z.string().optional() });

const listQuerySchema = pageQuerySchema.extend({ status: z.string().optional(), q: z.string().optional() });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00244")) digits = digits.slice(5);
  else if (digits.startsWith("244") && digits.length === 12) digits = digits.slice(3);
  if (!/^9\d{8}$/.test(digits)) return null;
  return `+244 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

function monthOf(date: Date) {
  return new Date(date.getTime() + 3_600_000).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${names[Number(value) - 1] ?? value} de ${year}`;
}

function statementDueDate(month: string, termsDays: number) {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const value = Number(monthPart);
  const lastDay = new Date(Date.UTC(year, value, 0, 12));
  lastDay.setUTCDate(lastDay.getUTCDate() + termsDays);
  return lastDay.toISOString().slice(0, 10);
}

function businessAmounts(totals: number[], discountRate: number) {
  const gross = totals.reduce((sum, value) => sum + value, 0);
  const discount = Math.round(gross * discountRate);
  return { gross, discount, net: gross - discount, count: totals.length };
}

function contractOf(business: BusinessRow) {
  return {
    starts_at: business.contractStartsAt.toISOString(),
    ends_at: business.contractEndsAt.toISOString(),
    discount_rate: Number(business.contractDiscountRate),
    payment_terms_days: business.contractPaymentTermsDays,
    credit_limit_kz: business.contractCreditLimitKz,
  };
}

function contractIssues(contract: z.infer<typeof contractSchema>) {
  const issues: { field: string; message: string }[] = [];
  if (Number.isNaN(Date.parse(contract.starts_at)) || Number.isNaN(Date.parse(contract.ends_at)) || contract.ends_at <= contract.starts_at) {
    issues.push({ field: "ends_at", message: "O fim do contrato tem de ser depois do início." });
  }
  if (!Number.isFinite(contract.discount_rate) || contract.discount_rate < 0 || contract.discount_rate > 0.3) {
    issues.push({ field: "discount_rate", message: "O desconto tem de estar entre 0 % e 30 %." });
  }
  if (!(PAYMENT_TERMS as readonly number[]).includes(contract.payment_terms_days)) {
    issues.push({ field: "payment_terms_days", message: "Escolha um prazo de pagamento de 15, 30, 45 ou 60 dias." });
  }
  if (!Number.isInteger(contract.credit_limit_kz) || contract.credit_limit_kz < 0) {
    issues.push({ field: "credit_limit_kz", message: "O limite de crédito não pode ser negativo." });
  }
  return issues;
}

async function paidAtByRequest(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, Date>();
  const rows = await db.select().from(serviceRequestEvents).where(inArray(serviceRequestEvents.requestId, requestIds));
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.status !== "paid") continue;
    const current = map.get(row.requestId);
    if (!current || row.at < current) map.set(row.requestId, row.at);
  }
  return map;
}

function pricingTotal(row: ServiceRequestRow) {
  return (row.pricing as { total_kz?: number } | null)?.total_kz ?? 0;
}

async function memberIdsOf(businessId: string) {
  const rows = await db.select().from(businessMembers).where(eq(businessMembers.businessId, businessId));
  return rows.map((row) => row.clientAccountId);
}

type BusinessStatementView = ReturnType<typeof businessAmounts> & { month: string; due_date: string; status: string; paid_at: string | null; reference: string | null };

async function statementsOf(business: BusinessRow, now: Date): Promise<BusinessStatementView[]> {
  const memberIds = await memberIdsOf(business.id);
  if (memberIds.length === 0) return [];
  const requests = await db.select().from(serviceRequests).where(inArray(serviceRequests.clientAccountId, memberIds));
  const settled = requests.filter((row) => row.status === "paid" || row.status === "rated");
  const paidAt = await paidAtByRequest(settled.map((row) => row.id));
  const startsAt = business.contractStartsAt;

  const byMonth = new Map<string, number[]>();
  for (const row of settled) {
    const at = paidAt.get(row.id) ?? row.createdAt;
    if (at < startsAt) continue;
    const month = monthOf(at);
    byMonth.set(month, [...(byMonth.get(month) ?? []), pricingTotal(row)]);
  }

  const stored = await db.select().from(businessStatements).where(eq(businessStatements.businessId, business.id));
  const current = monthOf(now);
  const today = now.toISOString().slice(0, 10);
  const discountRate = Number(business.contractDiscountRate);

  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, totals]) => {
      const record = stored.find((item) => item.month === month);
      const dueDate = statementDueDate(month, business.contractPaymentTermsDays);
      const status = record ? "paid" : month === current ? "open" : dueDate < today ? "overdue" : "due";
      return {
        month,
        due_date: dueDate,
        status,
        paid_at: record ? record.paidAt.toISOString() : null,
        reference: record?.reference ?? null,
        ...businessAmounts(totals, discountRate),
      };
    });
}

function summaryOf(business: BusinessRow, statements: Awaited<ReturnType<typeof statementsOf>>, memberCount: number, now: Date) {
  const current = monthOf(now);
  const unpaid = statements.filter((statement) => statement.status !== "paid");
  const outstanding = unpaid.filter((statement) => statement.month !== current).reduce((sum, statement) => sum + statement.net, 0);
  const currentMonth = statements.find((statement) => statement.month === current) ?? { gross: 0, discount: 0, net: 0, count: 0 };
  const creditUsed = unpaid.reduce((sum, statement) => sum + statement.net, 0);
  return {
    id: business.id,
    name: business.name,
    nif: business.nif,
    sector: business.sector,
    contact_name: business.contactName,
    phone: business.phone,
    email: business.email,
    status: business.status,
    suspension_reason: business.suspensionReason,
    contract: contractOf(business),
    created_at: business.createdAt.toISOString(),
    members: memberCount,
    current_month: { gross: currentMonth.gross, discount: currentMonth.discount, net: currentMonth.net, count: currentMonth.count },
    outstanding,
    overdue: unpaid.filter((statement) => statement.status === "overdue").reduce((sum, statement) => sum + statement.net, 0),
    credit_used: creditUsed,
    over_limit: creditUsed > business.contractCreditLimitKz,
  };
}

async function detailOf(business: BusinessRow, now: Date) {
  const memberIds = await memberIdsOf(business.id);
  const statements = await statementsOf(business, now);
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const memberAccounts = memberIds.length ? await db.select().from(accounts).where(inArray(accounts.id, memberIds)) : [];
  const accountsById = new Map(memberAccounts.map((row) => [row.id, row]));
  const requests = memberIds.length ? await db.select().from(serviceRequests).where(inArray(serviceRequests.clientAccountId, memberIds)) : [];

  const memberClients = memberIds.flatMap((clientId) => {
    const account = accountsById.get(clientId);
    if (!account) return [];
    const requests30 = requests.filter((row) => row.clientAccountId === clientId && row.createdAt >= since).length;
    return [{ id: clientId, name: account.fullName, phone: account.phone ?? "", requests_30: requests30 }];
  });

  return { ...summaryOf(business, statements, memberIds.length, now), statements, member_clients: memberClients };
}

async function findBusinessOrNotFound(id: string): Promise<BusinessRow> {
  const [row] = await db.select().from(businessAccounts).where(eq(businessAccounts.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Conta empresarial não encontrada.");
  return row;
}

async function memberOf(clientId: string) {
  const [row] = await db.select().from(businessMembers).where(eq(businessMembers.clientAccountId, clientId)).limit(1);
  if (!row) return null;
  return findBusinessOrNotFound(row.businessId);
}

export async function adminBusinessRoutes(app: FastifyInstance) {
  app.get("/admin/business-accounts", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "business.view");
    const query = listQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status);
    if (statusFilter && !statusFilter.every((value) => (BUSINESS_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de conta empresarial inválido.");
    }

    const rows = await db.select().from(businessAccounts);
    const now = new Date();
    const filtered = rows.filter((row) => (!statusFilter?.length || statusFilter.includes(row.status)) && matchesText(query.q, row.name, row.nif, row.contactName, row.sector));
    const presented = await Promise.all(
      filtered.map(async (row) => summaryOf(row, await statementsOf(row, now), (await memberIdsOf(row.id)).length, now)),
    );
    const sorted = presented.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return listPageEnvelope(paginate(sorted, query));
  });

  app.get("/admin/business-accounts/candidates", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "business.manage");
    const memberRows = await db.select().from(businessMembers);
    const taken = new Set(memberRows.map((row) => row.clientAccountId));

    const clientRows = await db.select().from(clients);
    const available = clientRows.filter((client) => !client.blocked && !taken.has(client.accountId));
    const accountRows = available.length ? await db.select().from(accounts).where(inArray(accounts.id, available.map((client) => client.accountId))) : [];
    const accountsById = new Map(accountRows.map((row) => [row.id, row]));

    const items = available
      .map((client) => {
        const account = accountsById.get(client.accountId);
        if (!account) return null;
        return { id: client.accountId, name: account.fullName, phone: account.phone ?? "", requests_30: 0 };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));

    return dataEnvelope(items);
  });

  app.get("/admin/business-accounts/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "business.view");
    const { id } = request.params as { id: string };
    const business = await findBusinessOrNotFound(id);
    return dataEnvelope(await detailOf(business, new Date()));
  });

  app.post("/admin/business-accounts", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const body = createBodySchema.parse(request.body);

    const phone = normalizePhone(body.phone);
    const issues = [
      ...(body.name.trim().length < 2 ? [{ field: "name", message: "Indique o nome da empresa." }] : []),
      ...(!/^\d{9,14}$/.test(body.nif.trim()) ? [{ field: "nif", message: "O NIF tem entre 9 e 14 dígitos." }] : []),
      ...(body.contact_name.trim().length < 2 ? [{ field: "contact_name", message: "Indique o responsável." }] : []),
      ...(!phone ? [{ field: "phone", message: "Indique um telefone de Angola (+244 9XX XXX XXX)." }] : []),
      ...(!EMAIL.test(body.email.trim()) ? [{ field: "email", message: "Indique um e-mail válido." }] : []),
      ...contractIssues(body.contract),
    ];
    if (issues.length) throw apiError("validation", issues[0]!.message, { issues });

    const [existing] = await db.select().from(businessAccounts).where(eq(businessAccounts.nif, body.nif.trim())).limit(1);
    if (existing) throw apiError("validation", "Já existe uma conta empresarial com este NIF.", { issues: [{ field: "nif", message: "NIF já registado." }] });

    const [business] = await db
      .insert(businessAccounts)
      .values({
        id: newId("emp"),
        name: body.name.trim(),
        nif: body.nif.trim(),
        sector: body.sector?.trim() || "Outro",
        contactName: body.contact_name.trim(),
        phone: phone!,
        email: body.email.trim().toLowerCase(),
        status: "active",
        contractStartsAt: new Date(body.contract.starts_at),
        contractEndsAt: new Date(body.contract.ends_at),
        contractDiscountRate: body.contract.discount_rate.toString(),
        contractPaymentTermsDays: body.contract.payment_terms_days,
        contractCreditLimitKz: body.contract.credit_limit_kz,
      })
      .returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.create",
      targetModule: "business",
      targetId: business!.id,
      targetLabel: business!.name,
      reason: `NIF ${business!.nif}`,
    });

    return dataEnvelope(await detailOf(business!, new Date()));
  });

  app.put("/admin/business-accounts/:id/contract", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const { id } = request.params as { id: string };
    const body = updateContractBodySchema.parse(request.body);

    const business = await findBusinessOrNotFound(id);
    const issues = contractIssues(body.contract);
    if (issues.length) throw apiError("validation", issues[0]!.message, { issues });
    const why = requireReason(body.reason, "o motivo da alteração");

    const before = contractOf(business);
    const after = body.contract;
    const changes = [
      before.discount_rate !== after.discount_rate && { field: "Desconto", from: `${Math.round(before.discount_rate * 100)}%`, to: `${Math.round(after.discount_rate * 100)}%` },
      before.payment_terms_days !== after.payment_terms_days && { field: "Prazo de pagamento", from: `${before.payment_terms_days} dias`, to: `${after.payment_terms_days} dias` },
      before.credit_limit_kz !== after.credit_limit_kz && { field: "Limite de crédito", from: `${before.credit_limit_kz} Kz`, to: `${after.credit_limit_kz} Kz` },
      before.ends_at.slice(0, 10) !== after.ends_at.slice(0, 10) && { field: "Fim do contrato", from: before.ends_at.slice(0, 10), to: after.ends_at.slice(0, 10) },
    ].filter((change): change is { field: string; from: string; to: string } => Boolean(change));
    if (changes.length === 0 && before.starts_at.slice(0, 10) === after.starts_at.slice(0, 10)) {
      throw apiError("validation", "Não há alterações para guardar.");
    }

    await db
      .update(businessAccounts)
      .set({
        contractStartsAt: new Date(after.starts_at),
        contractEndsAt: new Date(after.ends_at),
        contractDiscountRate: after.discount_rate.toString(),
        contractPaymentTermsDays: after.payment_terms_days,
        contractCreditLimitKz: after.credit_limit_kz,
      })
      .where(eq(businessAccounts.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.contract",
      targetModule: "business",
      targetId: id,
      targetLabel: business.name,
      reason: why,
      changes,
    });

    return dataEnvelope(await detailOf(await findBusinessOrNotFound(id), new Date()));
  });

  app.post("/admin/business-accounts/:id/members", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const { id } = request.params as { id: string };
    const body = addMemberBodySchema.parse(request.body);

    const business = await findBusinessOrNotFound(id);
    if (business.status !== "active") throw apiError("invalid_transition", "A conta empresarial está suspensa.");

    const [client] = await db.select().from(clients).where(eq(clients.accountId, body.client_id)).limit(1);
    if (!client) throw apiError("not_found", "Cliente não encontrado.");
    const [clientAccount] = await db.select().from(accounts).where(eq(accounts.id, body.client_id)).limit(1);

    const other = await memberOf(body.client_id);
    if (other) {
      throw apiError("validation", other.id === id ? "O cliente já pertence a esta empresa." : `O cliente já pertence à empresa ${other.name}.`);
    }

    await db.insert(businessMembers).values({ id: newId("bmb"), businessId: id, clientAccountId: body.client_id });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.member_add",
      targetModule: "business",
      targetId: id,
      targetLabel: business.name,
      changes: [{ field: "Utilizador", from: "—", to: clientAccount?.fullName ?? body.client_id }],
    });

    return dataEnvelope(await detailOf(await findBusinessOrNotFound(id), new Date()));
  });

  app.post("/admin/business-accounts/:id/members/:clientId/remove", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const { id, clientId } = request.params as { id: string; clientId: string };
    const body = removeMemberBodySchema.parse(request.body);

    const business = await findBusinessOrNotFound(id);
    const [membership] = await db.select().from(businessMembers).where(eq(businessMembers.clientAccountId, clientId)).limit(1);
    if (!membership || membership.businessId !== id) throw apiError("validation", "O cliente não pertence a esta empresa.");
    const why = requireReason(body.reason, "o motivo");

    const [clientAccount] = await db.select().from(accounts).where(eq(accounts.id, clientId)).limit(1);
    await db.delete(businessMembers).where(eq(businessMembers.id, membership.id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.member_remove",
      targetModule: "business",
      targetId: id,
      targetLabel: business.name,
      reason: why,
      changes: [{ field: "Utilizador", from: clientAccount?.fullName ?? clientId, to: "—" }],
    });

    return dataEnvelope(await detailOf(await findBusinessOrNotFound(id), new Date()));
  });

  app.post("/admin/business-accounts/:id/statements/:month/paid", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const { id, month } = request.params as { id: string; month: string };
    const body = markPaidBodySchema.parse(request.body);

    const business = await findBusinessOrNotFound(id);
    const now = new Date();
    const statement = (await statementsOf(business, now)).find((item) => item.month === month);
    if (!statement) throw apiError("not_found", "Extracto não encontrado.");
    if (statement.status === "paid") throw apiError("invalid_transition", "Este extracto já está pago.");
    if (statement.status === "open") throw apiError("invalid_transition", "O mês ainda não fechou.");
    const reference = requireReason(body.reference, "a referência do pagamento");

    await db
      .insert(businessStatements)
      .values({ id: newId("stm"), businessId: id, month, reference })
      .onConflictDoUpdate({ target: [businessStatements.businessId, businessStatements.month], set: { paidAt: now, reference } });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.statement_paid",
      targetModule: "business",
      targetId: id,
      targetLabel: business.name,
      reason: `Referência ${reference}`,
      changes: [{ field: monthLabel(month), from: `${statement.net} Kz`, to: "Pago" }],
    });

    return dataEnvelope(await detailOf(await findBusinessOrNotFound(id), new Date()));
  });

  app.post("/admin/business-accounts/:id/suspend", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const { id } = request.params as { id: string };
    const body = statusReasonBodySchema.parse(request.body);

    const business = await findBusinessOrNotFound(id);
    if (business.status === "suspended") throw apiError("invalid_transition", "A conta já está suspensa.");
    const why = requireReason(body.reason, "o motivo");

    await db.update(businessAccounts).set({ status: "suspended", suspensionReason: why }).where(eq(businessAccounts.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.suspend",
      targetModule: "business",
      targetId: id,
      targetLabel: business.name,
      reason: why,
      changes: [{ field: "Estado", from: "Activa", to: "Suspensa" }],
    });

    return dataEnvelope(await detailOf(await findBusinessOrNotFound(id), new Date()));
  });

  app.post("/admin/business-accounts/:id/reactivate", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "business.manage");
    const { id } = request.params as { id: string };
    const body = statusReasonBodySchema.parse(request.body);

    const business = await findBusinessOrNotFound(id);
    if (business.status === "active") throw apiError("invalid_transition", "A conta já está activa.");
    const why = requireReason(body.reason, "o motivo");

    await db.update(businessAccounts).set({ status: "active", suspensionReason: null }).where(eq(businessAccounts.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "business.reactivate",
      targetModule: "business",
      targetId: id,
      targetLabel: business.name,
      reason: why,
      changes: [{ field: "Estado", from: "Suspensa", to: "Activa" }],
    });

    return dataEnvelope(await detailOf(await findBusinessOrNotFound(id), new Date()));
  });
}
