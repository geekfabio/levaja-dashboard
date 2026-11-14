import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { cashDeposits, settlementRecords } from "../db/schema/finance";
import { providers, serviceRequestEvents, serviceRequests } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { cashBalanceKz } from "../lib/cash-balance";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { csvList, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;
type SettlementRow = typeof settlementRecords.$inferSelect;

const VAT_RATE = 0.14;
const INVOICE_SERIES = "FT LJ";
const CASH_SETTLEMENT_DAYS = 7;
const SETTLED_STATUSES = ["paid", "rated"] as const;
const SETTLEMENT_METHODS = ["card", "bank_reference"] as const;

const invoicesQuerySchema = pageQuerySchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.string().optional(),
  method: z.string().optional(),
  q: z.string().optional(),
});

const settlementsQuerySchema = z.object({ from: z.string(), to: z.string(), method: z.string().optional(), status: z.string().optional() });

const registerSettlementBodySchema = z.object({ amount_kz: z.number().int().nonnegative(), reference: z.string().optional() });

const resolveSettlementBodySchema = z.object({ resolution: z.string().optional() });

const cashDebtsQuerySchema = pageQuerySchema.extend({ state: z.enum(["owing", "overdue", "all"]).optional(), q: z.string().optional() });

const cashDepositsQuerySchema = z.object({ provider_id: z.string().min(1) });

const registerCashDepositBodySchema = z.object({ provider_id: z.string().min(1), amount_kz: z.number().int().positive(), reference: z.string().optional() });

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

function vatSplit(total: number) {
  const net = Math.round(total / (1 + VAT_RATE));
  return { net, vat: total - net };
}

function documentNumber(year: number, sequence: number) {
  return `${INVOICE_SERIES} ${year}/${String(sequence).padStart(5, "0")}`;
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function paidAtByRequest(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, Date>();
  const events = await db.select().from(serviceRequestEvents).where(inArray(serviceRequestEvents.requestId, requestIds));
  const map = new Map<string, Date>();
  for (const event of events) {
    if (event.status !== "paid") continue;
    const current = map.get(event.requestId);
    if (!current || event.at < current) map.set(event.requestId, event.at);
  }
  return map;
}

async function buildInvoices() {
  const rows = (await db.select().from(serviceRequests)).filter((row) => isSettled(row) && row.paymentMethod);
  const paidAt = await paidAtByRequest(rows.map((row) => row.id));
  const clientIds = rows.map((row) => row.clientAccountId);
  const providerIds = rows.map((row) => row.providerAccountId).filter((id): id is string => Boolean(id));
  const accountRows = await db.select().from(accounts).where(inArray(accounts.id, [...clientIds, ...providerIds]));
  const accountsById = new Map(accountRows.map((row) => [row.id, row]));

  const sorted = [...rows].sort((a, b) => {
    const atA = (paidAt.get(a.id) ?? a.updatedAt).getTime();
    const atB = (paidAt.get(b.id) ?? b.updatedAt).getTime();
    return atA - atB || a.id.localeCompare(b.id);
  });

  const sequences = new Map<number, number>();
  return sorted.map((row) => {
    const at = paidAt.get(row.id) ?? row.updatedAt;
    const year = at.getUTCFullYear();
    const sequence = (sequences.get(year) ?? 0) + 1;
    sequences.set(year, sequence);
    const total = pricingTotal(row);
    const fee = pricingFee(row);
    const { net, vat } = vatSplit(total);
    const client = accountsById.get(row.clientAccountId);
    const provider = row.providerAccountId ? accountsById.get(row.providerAccountId) : undefined;
    return {
      id: `ft-${row.id}`,
      number: documentNumber(year, sequence),
      kind: "invoice" as const,
      issued_at: at.toISOString(),
      request_id: row.id,
      request_code: row.code,
      client_id: row.clientAccountId,
      client_name: client?.fullName ?? "Cliente",
      client_phone: client?.phone ?? "",
      provider_name: provider?.fullName,
      payment_method: row.paymentMethod,
      lines: [
        { description: `Pedido ${row.code}`, amount: total - fee },
        { description: "Taxa de serviço AngoLeva", amount: fee },
      ],
      vat_rate: VAT_RATE,
      net,
      vat,
      total,
    };
  });
}

function filterInvoices(invoices: Awaited<ReturnType<typeof buildInvoices>>, filters: { from?: string; to?: string; kind?: string[]; method?: string[]; q?: string }) {
  return invoices
    .filter((invoice) => !filters.kind?.length || filters.kind.includes(invoice.kind))
    .filter((invoice) => !filters.method?.length || filters.method.includes(invoice.payment_method ?? ""))
    .filter((invoice) => !filters.from || invoice.issued_at >= filters.from)
    .filter((invoice) => !filters.to || invoice.issued_at <= filters.to)
    .filter((invoice) => matchesText(filters.q, invoice.number, invoice.request_code, invoice.client_name, invoice.client_phone))
    .sort((a, b) => (a.issued_at < b.issued_at ? 1 : -1));
}

function settlementId(day: string, method: string) {
  return `st-${day}-${method}`;
}

function settlementStatus(expected: number, received: number | null, resolved: boolean): "pending" | "matched" | "mismatch" | "resolved" {
  if (received === null) return "pending";
  if (received === expected) return "matched";
  return resolved ? "resolved" : "mismatch";
}

function presentSettlement(stored: SettlementRow | undefined, day: string, method: string, expected: { expected: number; count: number }) {
  const received = stored?.received ?? null;
  return {
    id: settlementId(day, method),
    day,
    method,
    expected: expected.expected,
    received,
    count: expected.count,
    reference: stored?.reference ?? undefined,
    received_at: stored?.receivedAt ? stored.receivedAt.toISOString() : undefined,
    status: settlementStatus(expected.expected, received, Boolean(stored?.resolvedAt)),
    resolution: stored?.resolution ?? undefined,
    resolved_at: stored?.resolvedAt ? stored.resolvedAt.toISOString() : undefined,
  };
}

async function expectedSettlements(from: string, to: string) {
  const rows = (await db.select().from(serviceRequests)).filter(
    (row) => isSettled(row) && (row.paymentMethod === "card" || row.paymentMethod === "bank_reference"),
  );
  const paidAt = await paidAtByRequest(rows.map((row) => row.id));
  const totals = new Map<string, { expected: number; count: number }>();
  for (const row of rows) {
    const at = paidAt.get(row.id);
    if (!at) continue;
    const day = at.toISOString().slice(0, 10);
    if (day < from || day > to) continue;
    const key = `${day}:${row.paymentMethod}`;
    const entry = totals.get(key) ?? { expected: 0, count: 0 };
    entry.expected += pricingTotal(row);
    entry.count += 1;
    totals.set(key, entry);
  }
  return totals;
}

function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 400; ) {
    days.push(day);
    const next = new Date(`${day}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    day = next.toISOString().slice(0, 10);
  }
  return days;
}

async function settlementsIn(from: string, to: string) {
  const expected = await expectedSettlements(from, to);
  const storedRows = await db.select().from(settlementRecords).where(inArray(settlementRecords.day, daysBetween(from, to)));
  const items = [] as ReturnType<typeof presentSettlement>[];
  for (const day of daysBetween(from, to)) {
    for (const method of SETTLEMENT_METHODS) {
      const totals = expected.get(`${day}:${method}`) ?? { expected: 0, count: 0 };
      const stored = storedRows.find((item) => item.day === day && item.method === method);
      if (totals.expected === 0 && !stored) continue;
      items.push(presentSettlement(stored, day, method, totals));
    }
  }
  return items.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.method < b.method ? -1 : 1));
}

async function findOrCreateSettlement(id: string, today: string) {
  const match = /^st-(\d{4}-\d{2}-\d{2})-(card|bank_reference)$/.exec(id);
  if (!match) throw apiError("not_found", "Registo de reconciliação não encontrado.");
  const [, day, method] = match as unknown as [string, string, "card" | "bank_reference"];
  if (day > today) throw apiError("validation", "Não é possível conciliar um dia futuro.");

  let [stored] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, id)).limit(1);
  if (!stored) {
    [stored] = await db.insert(settlementRecords).values({ id, day, method }).returning();
  }
  const totals = (await expectedSettlements(day, day)).get(`${day}:${method}`) ?? { expected: 0, count: 0 };
  return { stored: stored!, day, method, totals };
}

async function cashCharges(providerAccountId: string) {
  const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, providerAccountId));
  const settled = rows.filter((row) => isSettled(row) && row.paymentMethod === "cash");
  const paidAt = await paidAtByRequest(settled.map((row) => row.id));
  return settled.map((row) => ({ at: paidAt.get(row.id) ?? row.createdAt, amount: pricingFee(row) + commissionOf(row) }));
}

function cashPosition(charges: { at: Date; amount: number }[], deposits: { at: Date; amount: number }[], now: Date) {
  const owed = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const deposited = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  let covered = deposited;
  let oldestUnsettledAt: Date | undefined;
  for (const charge of [...charges].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (covered >= charge.amount) {
      covered -= charge.amount;
      continue;
    }
    oldestUnsettledAt = charge.at;
    break;
  }
  const lastDepositAt = deposits.reduce<Date | undefined>((latest, deposit) => (!latest || deposit.at > latest ? deposit.at : latest), undefined);
  return {
    owed,
    deposited,
    balance: owed - deposited,
    oldest_unsettled_at: oldestUnsettledAt ? oldestUnsettledAt.toISOString() : undefined,
    overdue: oldestUnsettledAt ? now.getTime() - oldestUnsettledAt.getTime() > CASH_SETTLEMENT_DAYS * 86_400_000 : false,
    last_deposit_at: lastDepositAt ? lastDepositAt.toISOString() : undefined,
  };
}

async function cashDebtOf(providerAccountId: string, providerName: string, providerPhone: string, now: Date) {
  const charges = await cashCharges(providerAccountId);
  const deposits = (await db.select().from(cashDeposits).where(eq(cashDeposits.providerAccountId, providerAccountId))).map((row) => ({ at: row.at, amount: row.amountKz }));
  // What the platform owes the provider (ride bonus, discounts the client did not pay in cash) pays the debt off like a deposit would.
  const { creditsKz } = await cashBalanceKz(providerAccountId);
  const position = cashPosition(charges, creditsKz > 0 ? [...deposits, { at: new Date(0), amount: creditsKz }] : deposits, now);
  return {
    provider_id: providerAccountId,
    provider_name: providerName,
    provider_phone: providerPhone,
    cash_requests: charges.length,
    ...position,
    deposited: position.deposited - creditsKz,
    credits: creditsKz,
  };
}

export async function adminBillingRoutes(app: FastifyInstance) {
  app.get("/admin/billing/invoices", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "billing.view");
    const query = invoicesQuerySchema.parse(request.query);
    const items = filterInvoices(await buildInvoices(), { from: query.from, to: query.to, kind: csvList(query.kind), method: csvList(query.method), q: query.q });

    const invoices = items.filter((item) => item.kind === "invoice");
    const credits = items.filter((item) => item.kind !== "invoice");
    const page = paginate(items, query);

    return {
      data: page.items,
      meta: {
        count: page.items.length,
        total: page.total,
        page: page.page,
        page_size: page.page_size,
        totals: {
          invoiced_kz: invoices.reduce((sum, item) => sum + item.total, 0),
          credited_kz: -credits.reduce((sum, item) => sum + item.total, 0),
          vat_kz: items.reduce((sum, item) => sum + item.vat, 0),
          count: items.length,
        },
      },
    };
  });

  app.get("/admin/billing/invoices/export", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "billing.view");
    const query = invoicesQuerySchema.parse(request.query);
    const items = filterInvoices(await buildInvoices(), { from: query.from, to: query.to, kind: csvList(query.kind), method: csvList(query.method), q: query.q });
    return dataEnvelope(items);
  });

  app.get("/admin/billing/invoices/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "billing.view");
    const { id } = request.params as { id: string };
    const invoice = (await buildInvoices()).find((item) => item.id === id);
    if (!invoice) throw apiError("not_found", "Documento não encontrado.");
    return dataEnvelope(invoice);
  });

  app.get("/admin/billing/settlements", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "billing.view");
    const query = settlementsQuerySchema.parse(request.query);
    const from = query.from.slice(0, 10);
    const to = query.to.slice(0, 10);
    const methodFilter = csvList(query.method);
    const statusFilter = csvList(query.status);

    const items = (await settlementsIn(from, to))
      .filter((item) => !methodFilter?.length || methodFilter.includes(item.method))
      .filter((item) => !statusFilter?.length || statusFilter.includes(item.status));

    const received = items.reduce((sum, item) => sum + (item.received ?? 0), 0);
    const expected = items.filter((item) => item.received !== null).reduce((sum, item) => sum + item.expected, 0);

    return dataEnvelope({
      items,
      totals: {
        expected_kz: items.reduce((sum, item) => sum + item.expected, 0),
        received_kz: received,
        difference_kz: received - expected,
        open: items.filter((item) => item.status === "pending" || item.status === "mismatch").length,
      },
    });
  });

  app.post("/admin/billing/settlements/:id/register", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "billing.manage");
    const { id } = request.params as { id: string };
    const body = registerSettlementBodySchema.parse(request.body);
    const reference = requireReason(body.reference, "a referência do extracto");

    const today = new Date().toISOString().slice(0, 10);
    const { stored, day, method, totals } = await findOrCreateSettlement(id, today);
    if (stored.received !== null) throw apiError("invalid_transition", "Este recebimento já foi registado.");

    await db.update(settlementRecords).set({ received: body.amount_kz, reference, receivedAt: new Date() }).where(eq(settlementRecords.id, id));
    const [updated] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, id)).limit(1);
    const result = presentSettlement(updated, day, method, totals);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "settlement.register",
      targetModule: "settlement",
      targetId: id,
      targetLabel: `${day} · ${method}`,
      reason: `Referência ${reference}`,
      changes: [
        { field: "Recebido", from: "—", to: String(body.amount_kz) },
        { field: "Estado", from: "pending", to: result.status },
      ],
      sensitive: true,
    });

    return dataEnvelope(result);
  });

  app.post("/admin/billing/settlements/:id/resolve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "billing.manage");
    const { id } = request.params as { id: string };
    const body = resolveSettlementBodySchema.parse(request.body);
    const why = requireReason(body.resolution, "a justificação da diferença");

    const today = new Date().toISOString().slice(0, 10);
    const { stored, day, method, totals } = await findOrCreateSettlement(id, today);
    const current = presentSettlement(stored, day, method, totals);
    if (current.status !== "mismatch") throw apiError("invalid_transition", "Só é possível justificar dias com diferença.");

    await db.update(settlementRecords).set({ resolution: why, resolvedAt: new Date(), resolvedByAccountId: admin.id }).where(eq(settlementRecords.id, id));
    const [updated] = await db.select().from(settlementRecords).where(eq(settlementRecords.id, id)).limit(1);
    const result = presentSettlement(updated, day, method, totals);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "settlement.resolve",
      targetModule: "settlement",
      targetId: id,
      targetLabel: `${day} · ${method}`,
      reason: why,
      changes: [{ field: "Diferença", from: String((current.received ?? 0) - current.expected), to: "Justificada" }],
      sensitive: true,
    });

    return dataEnvelope(result);
  });

  app.get("/admin/billing/cash-debts", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "billing.view");
    const query = cashDebtsQuerySchema.parse(request.query);

    const providerRows = await db.select().from(providers);
    const accountRows = await db.select().from(accounts).where(inArray(accounts.id, providerRows.map((row) => row.accountId)));
    const accountsById = new Map(accountRows.map((row) => [row.id, row]));
    const now = new Date();

    const all = await Promise.all(
      providerRows.map(async (provider) => {
        const account = accountsById.get(provider.accountId);
        return cashDebtOf(provider.accountId, account?.fullName ?? "Prestador", account?.phone ?? "", now);
      }),
    );
    const withCharges = all.filter((debt) => debt.cash_requests > 0);

    const items = withCharges
      .filter((debt) => {
        if ((query.state ?? "owing") === "owing" && debt.balance <= 0) return false;
        if (query.state === "overdue" && !debt.overdue) return false;
        return matchesText(query.q, debt.provider_name, debt.provider_phone);
      })
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.balance - a.balance);

    const page = paginate(items, query);
    return {
      data: page.items,
      meta: {
        count: page.items.length,
        total: page.total,
        page: page.page,
        page_size: page.page_size,
        totals: {
          balance_kz: withCharges.reduce((sum, debt) => sum + Math.max(0, debt.balance), 0),
          overdue_providers: withCharges.filter((debt) => debt.overdue).length,
          owing_providers: withCharges.filter((debt) => debt.balance > 0).length,
        },
      },
    };
  });

  app.get("/admin/billing/cash-deposits", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "billing.view");
    const query = cashDepositsQuerySchema.parse(request.query);
    const rows = await db.select().from(cashDeposits).where(eq(cashDeposits.providerAccountId, query.provider_id));
    const accountRows = await db.select().from(accounts).where(inArray(accounts.id, rows.map((row) => row.recordedByAccountId).filter((id): id is string => Boolean(id))));
    const accountsById = new Map(accountRows.map((row) => [row.id, row]));

    const items = [...rows]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((row) => ({
        id: row.id,
        provider_id: row.providerAccountId,
        amount_kz: row.amountKz,
        reference: row.reference,
        at: row.at.toISOString(),
        recorded_by: row.recordedByAccountId ? accountsById.get(row.recordedByAccountId)?.fullName ?? null : null,
      }));

    return dataEnvelope(items);
  });

  app.post("/admin/billing/cash-deposits", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "billing.manage");
    const body = registerCashDepositBodySchema.parse(request.body);
    const reference = requireReason(body.reference, "a referência do depósito");

    const [provider] = await db.select().from(providers).where(eq(providers.accountId, body.provider_id)).limit(1);
    if (!provider) throw apiError("not_found", "Prestador não encontrado.");
    const [account] = await db.select().from(accounts).where(eq(accounts.id, body.provider_id)).limit(1);

    const debt = await cashDebtOf(body.provider_id, account?.fullName ?? "Prestador", account?.phone ?? "", new Date());
    if (body.amount_kz > debt.balance) {
      throw apiError("validation", `O valor passa a dívida actual (${Math.max(0, debt.balance)} Kz).`, { issues: [{ field: "amount_kz", message: "O valor passa a dívida actual." }] });
    }

    const [deposit] = await db
      .insert(cashDeposits)
      .values({ id: newId("cd"), providerAccountId: body.provider_id, amountKz: body.amount_kz, reference, recordedByAccountId: admin.id })
      .returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "cash.deposit",
      targetModule: "cash",
      targetId: deposit!.id,
      targetLabel: `${debt.provider_name} — ${body.amount_kz} Kz`,
      reason: `Referência ${reference}`,
      changes: [{ field: "Dívida de numerário", from: String(debt.balance), to: String(debt.balance - body.amount_kz) }],
      sensitive: true,
    });

    return dataEnvelope({
      id: deposit!.id,
      provider_id: deposit!.providerAccountId,
      amount_kz: deposit!.amountKz,
      reference: deposit!.reference,
      at: deposit!.at.toISOString(),
      recorded_by: admin.fullName,
    });
  });
}
