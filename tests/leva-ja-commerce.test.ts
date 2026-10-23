import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { broadcastIssues, businessAmounts, contractIssues, promotionDiscount, promotionStatus, renderBroadcast, smsParts, statementDueDate } from "@/lib/leva-ja/commerce";
import type { Promotion } from "@/types/leva-ja";

const NOW = new Date("2026-10-22T13:30:00.000Z");

async function setup(email = "financas@levaja.ao") {
  const repos = createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
  await repos.auth.login(email, "123456");
  return repos;
}

async function as(repos: Awaited<ReturnType<typeof setup>>, email: string) {
  await repos.auth.logout();
  await repos.auth.login(email, "123456");
}

async function rejectsWith(promise: Promise<unknown>, code: RepositoryErrorCode) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(isRepositoryError(error), "esperava RepositoryError");
    assert.equal(error.code, code);
    return true;
  });
}

const PROMOTION: Promotion = {
  id: "p",
  code: "TESTE10",
  name: "Teste",
  kind: "percent",
  value: 10,
  maxDiscount: 1500,
  minOrder: 5000,
  services: ["cargo"],
  zoneIds: [],
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-11-01T00:00:00.000Z",
  budget: 3000,
  perClientLimit: 1,
  firstOrderOnly: false,
  paused: false,
  createdAt: "2026-09-30T00:00:00.000Z",
  createdBy: "Teste",
  uses: [],
};

test("comércio: regras de contrato, extracto, promoção e mensagens", () => {
  assert.deepEqual(businessAmounts([10_000, 5000], 0.1), { gross: 15_000, discount: 1500, net: 13_500, count: 2 });
  assert.equal(statementDueDate("2026-09", 30), "2026-10-30");
  assert.equal(statementDueDate("2026-12", 15), "2027-01-15");
  assert.deepEqual(contractIssues({ startsAt: "2026-10-01", endsAt: "2026-09-01", discountRate: 0.4, paymentTermsDays: 20, creditLimit: -1 }).map((issue) => issue.field), ["endsAt", "discountRate", "paymentTermsDays", "creditLimit"]);
  const now = NOW.getTime();
  const order = { total: 20_000, kind: "cargo" as const, zoneId: "z", clientOrders: 3, clientUses: 0 };
  assert.equal(promotionDiscount(PROMOTION, order, now).discount, 1500);
  assert.equal(promotionDiscount(PROMOTION, { ...order, kind: "tow" }, now).discount, 0);
  assert.equal(promotionDiscount(PROMOTION, { ...order, total: 4000 }, now).discount, 0);
  assert.equal(promotionDiscount(PROMOTION, { ...order, clientUses: 1 }, now).discount, 0);
  assert.equal(promotionDiscount({ ...PROMOTION, uses: [{ requestId: "r", clientId: "c", discount: 2500, at: "" }] }, order, now).discount, 500);
  assert.equal(promotionStatus({ ...PROMOTION, uses: [{ requestId: "r", clientId: "c", discount: 3000, at: "" }] }, now), "exhausted");
  assert.equal(promotionStatus({ ...PROMOTION, paused: true }, now), "paused");
  assert.equal(promotionStatus({ ...PROMOTION, startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" }, now), "scheduled");
  assert.equal(smsParts("a".repeat(160)), 1);
  assert.equal(smsParts("a".repeat(161)), 2);
  assert.equal(renderBroadcast("Olá {nome}!", "Ana Neto"), "Olá Ana!");
  assert.deepEqual(broadcastIssues({ title: "Aviso", channel: "email", message: "Mensagem longa o suficiente" }).map((issue) => issue.field), ["subject"]);
  assert.deepEqual(broadcastIssues({ title: "Aviso", channel: "sms", message: "a".repeat(500) }).map((issue) => issue.field), ["message"]);
});

test("contas empresariais: extractos, membros, contrato e pagamento", async () => {
  const repos = await setup();
  const list = await repos.business.list();
  assert.equal(list.total, 3);
  const account = list.items.find((item) => item.status === "active" && item.outstanding > 0);
  assert.ok(account);
  const detail = await repos.business.get(account.id);
  const unpaid = detail.statements.find((statement) => statement.status === "due" || statement.status === "overdue");
  assert.ok(unpaid);
  assert.equal(unpaid.net, unpaid.gross - Math.round(unpaid.gross * detail.contract.discountRate));
  await rejectsWith(repos.business.markStatementPaid(account.id, unpaid.month, ""), "validation");
  const paid = await repos.business.markStatementPaid(account.id, unpaid.month, "EMP-TESTE");
  assert.equal(paid.statements.find((statement) => statement.month === unpaid.month)?.status, "paid");
  assert.ok(paid.outstanding < detail.outstanding);
  await rejectsWith(repos.business.markStatementPaid(account.id, unpaid.month, "EMP-2"), "invalid_transition");
  const other = list.items.find((item) => item.id !== account.id);
  const member = detail.memberClients[0];
  if (other) await rejectsWith(repos.business.addMember(other.id, member.id), "invalid_transition");
  await rejectsWith(repos.business.updateContract(account.id, { ...detail.contract, discountRate: 0.5 }, "Renegociado"), "validation");
  const updated = await repos.business.updateContract(account.id, { ...detail.contract, discountRate: 0.12 }, "Renegociado");
  assert.equal(updated.contract.discountRate, 0.12);
  await as(repos, "suporte@levaja.ao");
  assert.equal((await repos.business.list()).total, 3);
  await rejectsWith(repos.business.setStatus(account.id, "suspended", "Teste"), "forbidden");
});

test("promoções: criar com validação, pausar, retomar e terminar", async () => {
  const repos = await setup();
  const list = await repos.promotions.list();
  assert.deepEqual(new Set(list.items.map((item) => item.status)), new Set(["active", "ended", "paused", "scheduled"]));
  assert.ok(list.items.some((item) => item.usesCount > 0 && item.spent > 0));
  const input = {
    code: "leva20",
    name: "20 % de teste",
    kind: "percent" as const,
    value: 20,
    maxDiscount: 2000,
    minOrder: 0,
    services: [],
    zoneIds: [],
    startsAt: "2026-10-20T00:00:00.000Z",
    endsAt: "2026-11-20T00:00:00.000Z",
    budget: 50_000,
    perClientLimit: 1,
    firstOrderOnly: false,
  };
  await rejectsWith(repos.promotions.create({ ...input, code: "LEVAJA10" }), "validation");
  await rejectsWith(repos.promotions.create({ ...input, value: 80 }), "validation");
  const created = await repos.promotions.create(input);
  assert.equal(created.code, "LEVA20");
  assert.equal(created.status, "active");
  assert.equal((await repos.promotions.pause(created.id, "Revisão")).status, "paused");
  assert.equal((await repos.promotions.resume(created.id)).status, "active");
  assert.equal((await repos.promotions.end(created.id, "Fim antecipado")).status, "ended");
  await rejectsWith(repos.promotions.pause(created.id, "Outra"), "invalid_transition");
  await as(repos, "suporte@levaja.ao");
  await rejectsWith(repos.promotions.create({ ...input, code: "OUTRA1" }), "forbidden");
});

test("comunicações: público, rascunho, agendamento e envio só simulado", async () => {
  const repos = await setup("suporte@levaja.ao");
  const estimate = await repos.communications.estimate({ kind: "providers", segment: "online", zoneIds: [] });
  assert.equal(estimate.recipients, (await repos.providers.positions()).length);
  await rejectsWith(repos.communications.create({ title: "Aviso", channel: "email", audience: { kind: "clients", segment: "all", zoneIds: [] }, message: "Mensagem de teste suficiente" }), "validation");
  const draft = await repos.communications.create({ title: "Aviso", channel: "sms", audience: { kind: "clients", segment: "all", zoneIds: [] }, message: "Olá {nome}, temos novidades para si na Leva Já." });
  assert.equal(draft.status, "draft");
  await rejectsWith(repos.communications.schedule(draft.id, "2026-10-01T10:00:00.000Z"), "validation");
  const sent = await repos.communications.send(draft.id);
  assert.equal(sent.status, "sent");
  assert.equal((sent.delivered ?? 0) + (sent.failed ?? 0), sent.recipients);
  await rejectsWith(repos.communications.cancel(draft.id, "Tarde"), "invalid_transition");
  await as(repos, "financas@levaja.ao");
  await rejectsWith(repos.communications.list(), "forbidden");
});

test("relatórios: cada tipo tem colunas, linhas coerentes e resumo", async () => {
  const repos = await setup();
  for (const kind of ["operations", "finance", "providers", "zones", "business"] as const) {
    const report = await repos.reports.run(kind, { from: "2026-10-01", to: "2026-10-22" });
    assert.ok(report.columns.length >= 5, kind);
    assert.ok(report.rows.every((row) => row.length === report.columns.length), kind);
    assert.ok(report.summary.length >= 2, kind);
  }
  const operations = await repos.reports.run("operations", { from: "2026-10-01", to: "2026-10-22" });
  assert.equal(operations.rows.length, 22);
  assert.equal(operations.rows.reduce((sum, row) => sum + Number(row[1]), 0), operations.summary[0].value);
  await as(repos, "suporte@levaja.ao");
  await rejectsWith(repos.reports.run("finance", { from: "2026-10-01", to: "2026-10-22" }), "forbidden");
});
