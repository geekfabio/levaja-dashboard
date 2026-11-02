import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { batchIssues, buildInvoices, cashPosition, documentNumber, settlementStatus, vatSplit } from "@/lib/leva-ja/billing";

const NOW = new Date("2026-10-22T13:30:00.000Z");

async function setup(email = "financas@angoleva.ao") {
  const repos = createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
  await repos.auth.login(email, "123456");
  return repos;
}

async function rejectsWith(promise: Promise<unknown>, code: RepositoryErrorCode) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(isRepositoryError(error), "esperava RepositoryError");
    assert.equal(error.code, code);
    return true;
  });
}

test("facturação: IVA incluído, numeração por série e notas de crédito ligadas à factura", () => {
  assert.deepEqual(vatSplit(11_400, 0.14), { net: 10_000, vat: 1400 });
  assert.equal(documentNumber("FT LJ", 2026, 12), "FT LJ 2026/00012");
  const base = { kind: "cargo" as const, platformFee: 500, paymentMethod: "card" as const, clientId: "c", clientName: "Ana", clientPhone: "" };
  const invoices = buildInvoices(
    [
      { ...base, id: "r2", code: "LJ-2", paidAt: "2026-10-02T10:00:00.000Z", total: 5700 },
      { ...base, id: "r1", code: "LJ-1", paidAt: "2026-10-01T10:00:00.000Z", total: 11_400 },
    ],
    [{ id: "rf", requestId: "r1", amount: 1140, paidAt: "2026-10-05T10:00:00.000Z", reason: "Atraso" }],
    { vatRate: 0.14, invoiceSeries: "FT LJ", creditNoteSeries: "NC LJ" },
  );
  assert.deepEqual(invoices.map((invoice) => invoice.number), ["FT LJ 2026/00001", "FT LJ 2026/00002", "NC LJ 2026/00001"]);
  assert.equal(invoices[0].requestCode, "LJ-1");
  assert.equal(invoices[2].relatedNumber, "FT LJ 2026/00001");
  assert.equal(invoices[2].total, -1140);
  assert.equal(invoices[2].vat, -140);
});

test("facturação: estado da reconciliação, dívida de numerário por ordem e regras de lote", () => {
  assert.equal(settlementStatus(1000, null, false), "pending");
  assert.equal(settlementStatus(1000, 1000, false), "matched");
  assert.equal(settlementStatus(1000, 900, false), "mismatch");
  assert.equal(settlementStatus(1000, 900, true), "resolved");
  const day = 86_400_000;
  const now = Date.parse("2026-10-22T12:00:00.000Z");
  const charges = [
    { at: new Date(now - 10 * day).toISOString(), amount: 1000 },
    { at: new Date(now - 2 * day).toISOString(), amount: 500 },
  ];
  const partial = cashPosition(charges, [{ at: new Date(now - day).toISOString(), amount: 800 }], 7, now);
  assert.equal(partial.balance, 700);
  assert.equal(partial.overdue, true);
  const covered = cashPosition(charges, [{ at: new Date(now - day).toISOString(), amount: 1000 }], 7, now);
  assert.equal(covered.overdue, false);
  assert.equal(covered.oldestUnsettledAt, charges[1].at);
  assert.equal(batchIssues([], new Set()), "Escolha pelo menos um levantamento aprovado.");
  assert.ok(batchIssues([{ id: "w", status: "pending" }], new Set()));
  assert.ok(batchIssues([{ id: "w", status: "approved", batchId: "b" }], new Set(["b"])));
  assert.equal(batchIssues([{ id: "w", status: "approved", batchId: "old" }], new Set(["b"])), null);
});

test("facturação: facturas e notas de crédito vêm dos pedidos e reembolsos pagos", async () => {
  const repos = await setup();
  const page = await repos.billing.invoices({ pageSize: 500 });
  assert.ok(page.totals.count > 0 && page.totals.invoiced > 0);
  const credits = page.items.filter((invoice) => invoice.kind === "credit_note");
  assert.ok(credits.length >= 1);
  assert.ok(credits.every((credit) => credit.relatedNumber?.startsWith("FT LJ")));
  const numbers = new Set(page.items.map((invoice) => invoice.number));
  assert.equal(numbers.size, page.items.length);
  const one = await repos.billing.invoice(page.items[0].id);
  assert.equal(one.number, page.items[0].number);
  await rejectsWith(repos.billing.invoice("ft-inexistente"), "not_found");
  const support = await setup("suporte@angoleva.ao");
  await rejectsWith(support.billing.invoices(), "forbidden");
});

test("facturação: reconciliação regista recebimento e justifica diferença", async () => {
  const repos = await setup();
  const report = await repos.billing.settlements({ from: "2026-09-30", to: "2026-10-22" });
  assert.ok(report.items.some((item) => item.status === "matched"));
  const mismatch = report.items.find((item) => item.status === "mismatch");
  assert.ok(mismatch, "esperava um dia com diferença");
  await rejectsWith(repos.billing.resolveSettlement(mismatch.id, ""), "validation");
  const resolved = await repos.billing.resolveSettlement(mismatch.id, "Comissão da gateway");
  assert.equal(resolved.status, "resolved");
  const pending = report.items.find((item) => item.status === "pending");
  assert.ok(pending, "esperava um dia por receber");
  const registered = await repos.billing.registerSettlement(pending.id, pending.expected, "EMIS-123");
  assert.equal(registered.status, "matched");
  await rejectsWith(repos.billing.registerSettlement(pending.id, 1, "EMIS-124"), "invalid_transition");
  await repos.auth.logout();
  await repos.auth.login("admin@angoleva.ao", "123456");
  const audit = await repos.audit.list({ action: ["settlement.register"], pageSize: 1 });
  assert.equal(audit.items[0].entity.id, pending.id);
});

test("facturação: entrega de numerário reduz a dívida e não passa o devido", async () => {
  const repos = await setup();
  const debts = await repos.billing.cashDebts({ state: "owing", pageSize: 50 });
  assert.ok(debts.items.length > 0);
  assert.ok(debts.totals.overdueProviders >= 1);
  const debt = debts.items[0];
  await rejectsWith(repos.billing.registerCashDeposit(debt.providerId, debt.balance + 1, "DEP1"), "validation");
  await repos.billing.registerCashDeposit(debt.providerId, debt.balance, "DEP123456");
  const after = await repos.billing.cashDebts({ state: "all", q: debt.providerName, pageSize: 5 });
  assert.equal(after.items.find((item) => item.providerId === debt.providerId)?.balance, 0);
  const deposits = await repos.billing.cashDeposits(debt.providerId);
  assert.equal(deposits[0].reference, "DEP123456");
});

test("lotes: criar com aprovados, enviar, pagar todos e não repetir levantamentos", async () => {
  const repos = await setup();
  const approved = (await repos.finance.withdrawals({ status: ["approved"], pageSize: 50 })).items;
  assert.ok(approved.length >= 1);
  const pending = (await repos.finance.withdrawals({ status: ["pending"], pageSize: 1 })).items[0];
  await rejectsWith(repos.finance.createBatch([pending.id]), "validation");
  const batch = await repos.finance.createBatch(approved.map((withdrawal) => withdrawal.id));
  assert.equal(batch.status, "draft");
  await rejectsWith(repos.finance.createBatch([approved[0].id]), "validation");
  await rejectsWith(repos.finance.markBatchPaid(batch.id, "BAI1"), "invalid_transition");
  const sent = await repos.finance.sendBatch(batch.id);
  assert.equal(sent.withdrawals.length, approved.length);
  const paid = await repos.finance.markBatchPaid(batch.id, "BAI987654");
  assert.equal(paid.status, "paid");
  const after = (await repos.finance.withdrawals({ status: ["paid"], q: "BAI987654", pageSize: 50 })).items;
  assert.equal(after.length, approved.length);
  await rejectsWith(repos.finance.cancelBatch(batch.id, "Engano"), "invalid_transition");
  const history = await repos.finance.batches({ pageSize: 10 });
  assert.ok(history.items.length >= 3);
});
