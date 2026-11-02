import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { isDisputeOverdue, refundableAmount, validateRefund } from "@/lib/leva-ja/refunds";
import { validateSettingsSection } from "@/lib/leva-ja/settings";

const NOW = new Date("2026-10-22T13:30:00.000Z");

function create() {
  return createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
}

async function as(repos: ReturnType<typeof create>, email: string) {
  await repos.auth.logout().catch(() => undefined);
  await repos.auth.login(email, "123456");
}

async function rejectsWith(promise: Promise<unknown>, code: RepositoryErrorCode) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(isRepositoryError(error), "esperava RepositoryError");
    assert.equal(error.code, code);
    return true;
  });
}

async function freshPaidRequest(repos: ReturnType<typeof create>) {
  const page = await repos.requests.list({ status: ["paid", "rated"], from: "2026-10-12", pageSize: 100 });
  for (const request of page.items) {
    const info = await repos.refunds.forRequest(request.id);
    if (info.refunds.length === 0 && !request.dispute && request.provider) return { request, info };
  }
  throw new Error("sem pedido pago recente");
}

test("reembolsos: regras puras de valor, prazo e atraso das disputas", () => {
  const request = { id: "r1", status: "paid" as const, price: { base: 0, distance: 0, extras: 0, platformFee: 0, total: 10_000 } };
  const refunds = [
    { id: "a", requestId: "r1", status: "paid" as const, amount: 3000 },
    { id: "b", requestId: "r1", status: "rejected" as const, amount: 5000 },
  ];
  assert.equal(refundableAmount(request, refunds), 7000);
  assert.equal(refundableAmount({ ...request, status: "delivered" }, refunds), 0);
  const base = { reason: "Cobrança duplicada", available: 7000, now: NOW, settings: { refundWindowDays: 30 } };
  assert.deepEqual(validateRefund({ ...base, amount: 7000 }), []);
  assert.equal(validateRefund({ ...base, amount: 7001 })[0].field, "amount");
  assert.equal(validateRefund({ ...base, amount: 100.5 })[0].field, "amount");
  assert.equal(validateRefund({ ...base, amount: 100, paidAt: "2026-08-01T10:00:00.000Z" })[0].field, "request");
  assert.equal(isDisputeOverdue({ openedAt: "2026-10-18T10:00:00.000Z" }, NOW.getTime()), true);
  assert.equal(isDisputeOverdue({ openedAt: "2026-10-21T10:00:00.000Z" }, NOW.getTime()), false);
  assert.ok(validateSettingsSection("payouts", { methods: ["card"], minimumWithdrawal: 0, payoutFrequency: "weekly", multicaixaEntity: "10116", cashSettlementDays: 7, refundWindowDays: 0, refundDualApprovalAbove: 0 }).some((issue) => issue.field === "refundWindowDays"));
});

test("reembolsos: semente traz reembolsos em todos os estados e disputas com categoria", async () => {
  const repos = create();
  await as(repos, "financas@angoleva.ao");
  const all = await repos.refunds.list({ pageSize: 50 });
  assert.deepEqual(new Set(all.items.map((refund) => refund.status)), new Set(["pending", "approved", "paid", "rejected"]));
  const summary = await repos.refunds.summary();
  assert.ok(summary.pendingCount >= 1 && summary.pendingAmount > 0);
  await as(repos, "operacoes@angoleva.ao");
  const disputes = await repos.disputes.list({ pageSize: 50 });
  assert.ok(disputes.items.length >= 3);
  assert.ok(disputes.items.every((item) => item.request.dispute?.category));
  assert.ok((await repos.disputes.summary()).open >= 1);
});

test("reembolsos: pedir, aprovar com dupla aprovação, pagar e imputar ao prestador", async () => {
  const repos = create();
  await as(repos, "suporte@angoleva.ao");
  const { request, info } = await freshPaidRequest(repos);
  await rejectsWith(repos.refunds.create({ requestId: request.id, amount: info.refundable + 1, reason: "Serviço não prestado", chargeProvider: true }), "validation");
  await rejectsWith(repos.refunds.create({ requestId: request.id, amount: 1000, reason: "", chargeProvider: true }), "validation");
  const refund = await repos.refunds.create({ requestId: request.id, amount: info.refundable, reason: "Serviço não prestado", chargeProvider: true });
  assert.equal(refund.status, "pending");
  assert.equal((await repos.refunds.forRequest(request.id)).refundable, 0);
  await rejectsWith(repos.refunds.approve(refund.id), "forbidden");

  await as(repos, "admin@angoleva.ao");
  const before = await repos.providers.get(request.provider?.id ?? "");
  const settings = await repos.settings.get();
  await repos.settings.update("payouts", { ...settings.payouts, refundDualApprovalAbove: 0 }, "Teste de dupla aprovação");
  const other = await freshPaidRequest(repos);
  const mine = await repos.refunds.create({ requestId: other.request.id, amount: 500, reason: "Teste de dupla aprovação", chargeProvider: false });
  await rejectsWith(repos.refunds.approve(mine.id), "forbidden");

  await as(repos, "financas@angoleva.ao");
  assert.equal((await repos.refunds.approve(mine.id)).status, "approved");
  const approved = await repos.refunds.approve(refund.id);
  assert.equal(approved.status, "approved");
  await rejectsWith(repos.refunds.markPaid(refund.id, ""), "validation");
  const paid = await repos.refunds.markPaid(refund.id, "DEV123456");
  assert.equal(paid.status, "paid");
  await rejectsWith(repos.refunds.reject(refund.id, "Tarde demais"), "invalid_transition");
  const transactions = await repos.finance.transactions({ kind: ["refund"], pageSize: 50 });
  assert.ok(transactions.items.some((transaction) => transaction.requestId === request.id && transaction.amount === -refund.amount));
  await as(repos, "admin@angoleva.ao");
  const after = await repos.providers.get(request.provider?.id ?? "");
  assert.equal(after.balance, before.balance - refund.amount);
  const audit = await repos.audit.list({ action: ["refund.paid"], pageSize: 5 });
  assert.equal(audit.items[0].entity.id, refund.id);
});

test("disputas: notas, resolução parcial gera reembolso e não se resolve duas vezes", async () => {
  const repos = create();
  await as(repos, "admin@angoleva.ao");
  const { request, info } = await freshPaidRequest(repos);
  await repos.requests.openDispute(request.id, "Móvel riscado na descarga", "damage");
  const noted = await repos.disputes.addNote(request.id, "Fotografias recebidas.");
  assert.equal(noted.dispute?.notes?.at(-1)?.text, "Fotografias recebidas.");
  await rejectsWith(repos.disputes.resolve(request.id, { outcome: "refund_partial", amount: info.refundable, resolution: "Dano confirmado" }), "validation");
  await rejectsWith(repos.disputes.resolve(request.id, { outcome: "no_refund", resolution: "" }), "validation");
  const resolved = await repos.disputes.resolve(request.id, { outcome: "refund_partial", amount: 2000, chargeProvider: true, resolution: "Dano confirmado pelo prestador" });
  assert.equal(resolved.dispute?.outcome, "refund_partial");
  assert.ok(resolved.dispute?.resolvedAt);
  const refunds = await repos.refunds.forRequest(request.id);
  assert.equal(refunds.refunds[0].source, "dispute");
  assert.equal(refunds.refunds[0].amount, 2000);
  assert.equal(refunds.refunds[0].id, resolved.dispute?.refundId);
  await rejectsWith(repos.disputes.resolve(request.id, { outcome: "no_refund", resolution: "Outra vez" }), "invalid_transition");

  const delivered = (await repos.requests.list({ status: ["delivered"], pageSize: 1 })).items[0];
  if (delivered) {
    await repos.requests.openDispute(delivered.id, "Cliente não pagou", "payment");
    await rejectsWith(repos.disputes.resolve(delivered.id, { outcome: "refund_full", resolution: "Devolver" }), "validation");
  }

  await as(repos, "financas@angoleva.ao");
  await rejectsWith(repos.disputes.list(), "forbidden");
});
