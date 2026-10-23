import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { SEED_ELIGIBLE_AFTER_APPROVAL } from "@/data/leva-ja/mock/seed";
import { isEligible } from "@/lib/leva-ja/eligibility";
import { STATUS_FLOW } from "@/lib/leva-ja/status";

const NOW = new Date("2026-10-22T13:30:00.000Z");
const TODAY = "2026-10-22";

async function setup(email = "admin@levaja.ao") {
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

test("contrato: transição inválida é recusada", async () => {
  const repos = await setup();
  const rated = (await repos.requests.list({ status: ["rated"], pageSize: 1 })).items[0];
  await rejectsWith(repos.requests.cancel(rated.id, "Cliente desistiu"), "invalid_transition");
  await rejectsWith(repos.requests.forceComplete(rated.id, "Sem disputa"), "invalid_transition");
  const delivered = (await repos.requests.list({ status: ["searching"], pageSize: 1 })).items[0];
  await rejectsWith(repos.requests.openDispute(delivered.id, "Carga danificada"), "invalid_transition");
  const after = await repos.requests.get(rated.id);
  assert.equal(after.status, "rated");
});

test("contrato: cancelamento sem motivo é recusado", async () => {
  const repos = await setup();
  const searching = (await repos.requests.list({ status: ["searching"], pageSize: 1 })).items[0];
  await rejectsWith(repos.requests.cancel(searching.id, ""), "validation");
  await rejectsWith(repos.requests.cancel(searching.id, "   "), "validation");
  assert.equal((await repos.requests.get(searching.id)).status, "searching");
  const cancelled = await repos.requests.cancel(searching.id, "Cliente pediu por telefone");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelReason, "Cliente pediu por telefone");
  assert.equal(cancelled.timeline.at(-1)?.status, "cancelled");
  const audit = await repos.audit.list({ entityId: searching.id });
  assert.equal(audit.items[0].action, "request.cancel");
  assert.equal(audit.items[0].reason, "Cliente pediu por telefone");
  assert.equal(audit.items[0].actorName, "Armando Silva");
});

test("contrato: aprovar o último documento torna o prestador elegível", async () => {
  const repos = await setup("operacoes@levaja.ao");
  const before = await repos.providers.get(SEED_ELIGIBLE_AFTER_APPROVAL);
  const coverage = { kind: before.services[0], zoneId: before.zoneIds[0] };
  assert.equal(before.availability, "online");
  assert.equal(before.accountStatus, "active");
  assert.equal(before.verified, false);
  assert.equal(isEligible(before, coverage, TODAY), false);
  const pending = before.documents.filter((document) => document.state !== "verified");
  assert.equal(pending.length, 1);
  await rejectsWith(repos.documents.approve(pending[0].id, "2026-10-01"), "validation");
  const approved = await repos.documents.approve(pending[0].id, "2027-10-22");
  assert.equal(approved.document.state, "verified");
  const after = await repos.providers.get(SEED_ELIGIBLE_AFTER_APPROVAL);
  assert.equal(after.verified, true);
  assert.equal(isEligible(after, coverage, TODAY), true);
});

test("contrato: levantamento acima do saldo é recusado", async () => {
  const repos = await setup("financas@levaja.ao");
  const provider = (await repos.providers.list({ pageSize: 50 })).items.find((item) => item.balance > 10_000);
  assert.ok(provider);
  const pending = await repos.finance.withdrawals({ status: ["pending", "approved"], pageSize: 100 });
  const reserved = pending.items.filter((item) => item.providerId === provider.id).reduce((sum, item) => sum + item.amount, 0);
  const free = provider.balance - reserved;
  await rejectsWith(repos.finance.requestWithdrawal(provider.id, free + 1), "validation");
  await rejectsWith(repos.finance.requestWithdrawal(provider.id, 0), "validation");
  const ok = await repos.finance.requestWithdrawal(provider.id, Math.floor(free / 2));
  assert.equal(ok.status, "pending");
  await rejectsWith(repos.finance.requestWithdrawal(provider.id, Math.ceil(free / 2) + 1), "validation");
});

test("contrato: pagar um levantamento desconta o saldo e cria transacção", async () => {
  const repos = await setup("financas@levaja.ao");
  const withdrawal = (await repos.finance.withdrawals({ status: ["pending"], pageSize: 1 })).items[0];
  const before = await repos.providers.get(withdrawal.providerId);
  await rejectsWith(repos.finance.markWithdrawalPaid(withdrawal.id, "TRF1"), "invalid_transition");
  await repos.finance.approveWithdrawal(withdrawal.id);
  const paid = await repos.finance.markWithdrawalPaid(withdrawal.id, "TRF123456");
  assert.equal(paid.status, "paid");
  const after = await repos.providers.get(withdrawal.providerId);
  assert.equal(after.balance, before.balance - withdrawal.amount);
  const transactions = await repos.providers.transactions(withdrawal.providerId, { pageSize: 5 });
  assert.equal(transactions.items[0].kind, "withdrawal");
  assert.equal(transactions.items[0].amount, -withdrawal.amount);
});

test("contrato: forçar a conclusão percorre os estados um a um", async () => {
  const repos = await setup();
  const disputed = (await repos.requests.list({ disputed: true, pageSize: 20 })).items.find((item) => item.status !== "rated");
  const target = disputed ?? (await repos.requests.list({ status: ["delivered"], pageSize: 1 })).items[0];
  if (!target.dispute || target.dispute.resolvedAt) await repos.requests.openDispute(target.id, "Valor contestado");
  await rejectsWith(repos.requests.forceComplete(target.id, ""), "validation");
  const done = await repos.requests.forceComplete(target.id, "Comprovativo confirma a entrega");
  assert.equal(done.status, "rated");
  assert.equal(done.dispute?.resolution, "Comprovativo confirma a entrega");
  const statuses = done.timeline.map((event) => event.status);
  const tail = statuses.slice(statuses.indexOf(target.status));
  assert.deepEqual(tail, STATUS_FLOW.slice(STATUS_FLOW.indexOf(target.status)));
});

test("contrato: reatribuição exige prestador elegível e volta a «atribuído»", async () => {
  const repos = await setup("operacoes@levaja.ao");
  const request = (await repos.requests.list({ status: ["en_route"], pageSize: 1 })).items[0];
  const candidates = await repos.requests.reassignCandidates(request.id);
  const ineligible = candidates.find((candidate) => candidate.issues.length > 0);
  const eligible = candidates.find((candidate) => candidate.issues.length === 0);
  assert.ok(ineligible);
  await rejectsWith(repos.requests.reassign(request.id, ineligible.provider.id, "Prestador avariou"), "validation");
  if (eligible) {
    await rejectsWith(repos.requests.reassign(request.id, eligible.provider.id, ""), "validation");
    const moved = await repos.requests.reassign(request.id, eligible.provider.id, "Prestador avariou");
    assert.equal(moved.status, "assigned");
    assert.equal(moved.providerId, eligible.provider.id);
    assert.equal(moved.timeline.at(-1)?.status, "assigned");
  }
});

test("contrato: sem sessão devolve unauthorized e o papel limita as acções", async () => {
  const anonymous = createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
  await rejectsWith(anonymous.requests.list(), "unauthorized");
  await rejectsWith(anonymous.auth.login("admin@levaja.ao", "000000"), "unauthorized");
  const finance = await setup("financas@levaja.ao");
  const request = (await finance.requests.list({ status: ["searching"], pageSize: 1 })).items[0];
  await rejectsWith(finance.requests.cancel(request.id, "Sem permissão"), "forbidden");
  await rejectsWith(finance.audit.list(), "forbidden");
  const support = await setup("suporte@levaja.ao");
  await rejectsWith(support.finance.withdrawals(), "forbidden");
  await rejectsWith(support.pricing.update((await setup()).database.state.pricing, "Teste"), "forbidden");
});

test("contrato: preços validados, com motivo e registados na auditoria", async () => {
  const repos = await setup();
  const pricing = await repos.pricing.get();
  const broken = { ...pricing, rules: pricing.rules.map((rule) => (rule.kind === "tow" ? { ...rule, base: -1 } : rule)) };
  await rejectsWith(repos.pricing.update(broken, "Teste"), "validation");
  const next = { ...pricing, platformFee: 600 };
  await rejectsWith(repos.pricing.update(next, ""), "validation");
  const saved = await repos.pricing.update(next, "Ajuste de taxa");
  assert.equal(saved.platformFee, 600);
  const audit = await repos.audit.list({ action: ["pricing.update"] });
  assert.equal(audit.items[0].reason, "Ajuste de taxa");
  assert.deepEqual(audit.items[0].changes?.[0].field, "Taxa da plataforma");
});

test("contrato: zona com prestadores não pode ser removida", async () => {
  const repos = await setup("operacoes@levaja.ao");
  const zones = await repos.zones.list();
  const busy = zones.find((zone) => zone.providersCount > 0);
  assert.ok(busy);
  await rejectsWith(repos.zones.remove(busy.id, "Teste"), "validation");
  const created = await repos.zones.create({ name: "Zango", coords: { latitude: -8.99, longitude: 13.45 }, radiusKm: 4 }, "Expansão");
  await rejectsWith(repos.zones.create({ name: "zango", coords: { latitude: -8.99, longitude: 13.45 }, radiusKm: 4 }, "Expansão"), "validation");
  await repos.zones.remove(created.id, "Criada por engano");
  assert.equal((await repos.zones.list()).some((zone) => zone.id === created.id), false);
});

test("contrato: leituras devolvem cópias defensivas", async () => {
  const repos = await setup();
  const request = (await repos.requests.list({ pageSize: 1 })).items[0];
  request.status = "cancelled";
  request.timeline.length = 0;
  const again = await repos.requests.get(request.id);
  assert.notEqual(again.status, "cancelled");
  assert.ok(again.timeline.length > 0);
});

test("contrato: falhas de rede simuladas chegam como network", async () => {
  const repos = await setup();
  repos.demo?.configure({ failureRate: 1 });
  await rejectsWith(repos.requests.list(), "network");
  repos.demo?.configure({ failureRate: 0 });
  assert.ok((await repos.requests.list()).total > 0);
});

test("contrato: ocorrências atribuídas, respondidas e resolvidas ficam na auditoria", async () => {
  const repos = await setup("suporte@levaja.ao");
  const ticket = (await repos.support.tickets({ status: ["open"], pageSize: 1 })).items[0];
  const assignee = (await repos.support.assignees()).find((user) => user.id !== ticket.assigneeId);
  assert.ok(assignee);
  const assigned = await repos.support.assignTicket(ticket.id, assignee.id);
  assert.equal(assigned.status, "in_progress");
  await rejectsWith(repos.support.replyTicket(ticket.id, ""), "validation");
  const replied = await repos.support.replyTicket(ticket.id, "Estamos a tratar do assunto.");
  assert.equal(replied.messages.at(-1)?.author, "admin");
  await rejectsWith(repos.support.resolveTicket(ticket.id, " "), "validation");
  const resolved = await repos.support.resolveTicket(ticket.id, "Valor reembolsado.");
  assert.equal(resolved.status, "resolved");
  await rejectsWith(repos.support.replyTicket(ticket.id, "Mais uma"), "invalid_transition");
  await repos.auth.logout();
  await repos.auth.login("admin@levaja.ao", "123456");
  const audit = await repos.audit.list({ entityId: ticket.id });
  assert.deepEqual(
    audit.items.map((entry) => entry.action),
    ["ticket.resolve", "ticket.reply", "ticket.assign"],
  );
});

test("contrato: SOS acompanhado e resolvido com resolução obrigatória", async () => {
  const repos = await setup("operacoes@levaja.ao");
  const [alert] = await repos.support.sosAlerts(["open"]);
  const acknowledged = await repos.support.acknowledgeSos(alert.id);
  assert.equal(acknowledged.status, "acknowledged");
  await rejectsWith(repos.support.acknowledgeSos(alert.id), "invalid_transition");
  await rejectsWith(repos.support.resolveSos(alert.id, ""), "validation");
  const resolved = await repos.support.resolveSos(alert.id, "Cliente em segurança.");
  assert.equal(resolved.status, "resolved");
  await rejectsWith(repos.support.lowRatings(), "forbidden");
});

test("contrato: avaliação baixa revista com nota e utilizadores do painel", async () => {
  const support = await setup("suporte@levaja.ao");
  const pending = (await support.support.lowRatings({ handled: false, pageSize: 1 })).items[0];
  assert.ok(pending.rating <= 2);
  const handled = await support.support.markReviewHandled(pending.id, "Prestador advertido.");
  assert.equal(handled.handled, true);
  await rejectsWith(support.support.markReviewHandled(pending.id, "De novo"), "invalid_transition");
  await rejectsWith(support.auth.listUsers(), "forbidden");
  const admin = await setup();
  await rejectsWith(admin.auth.createUser({ name: "Ana", email: "admin@levaja.ao", role: "support" }, "Teste"), "validation");
  const created = await admin.auth.createUser({ name: "Délcio Mateus", email: "delcio.mateus@levaja.ao", role: "finance" }, "Reforço da equipa");
  const self = (await admin.auth.listUsers()).find((user) => user.email === "admin@levaja.ao");
  assert.ok(self);
  await rejectsWith(admin.auth.changeRole(self.id, "support", "Teste"), "validation");
  const changed = await admin.auth.changeRole(created.id, "operations", "Mudou de equipa");
  assert.equal(changed.role, "operations");
  await admin.auth.setActive(created.id, false, "Saiu da empresa");
  await rejectsWith(admin.auth.login("delcio.mateus@levaja.ao", "123456"), "unauthorized");
});

test("contrato: definições validadas, com permissão por secção e efeito nas regras", async () => {
  const repos = await setup("operacoes@levaja.ao");
  const settings = await repos.settings.get();
  await rejectsWith(repos.settings.update("tax", { ...settings.tax, vatRate: 0.2 }, "Teste"), "forbidden");
  await rejectsWith(repos.settings.update("dispatch", { ...settings.dispatch, maxRadiusKm: 2 }, "Teste"), "validation");
  await rejectsWith(repos.settings.update("dispatch", settings.dispatch, "Teste"), "validation");
  await rejectsWith(repos.settings.update("dispatch", { ...settings.dispatch, stalledAfterMinutes: 60 }, ""), "validation");
  const before = await repos.metrics.attention();
  await repos.settings.update("dispatch", { ...settings.dispatch, stalledAfterMinutes: 60 }, "Menos alertas");
  const after = await repos.metrics.attention();
  assert.ok(before.stalledSearching.length > 0);
  assert.equal(after.stalledSearching.length, 0);
  const pending = (await repos.documents.queue({ pageSize: 1 })).items[0];
  await repos.settings.update(
    "documents",
    { ...settings.documents, requirements: settings.documents.requirements.map((item) => ({ ...item, minValidityDays: 365 })) },
    "Exigir um ano de validade",
  );
  await rejectsWith(repos.documents.approve(pending.document.id, "2027-01-15"), "validation");
  await repos.auth.logout();
  await repos.auth.login("admin@levaja.ao", "123456");
  const audit = await repos.audit.list({ action: ["settings.update"] });
  assert.equal(audit.items.length, 2);
  assert.equal(audit.items[1].changes?.[0].field, "Pedido parado ao fim de");
});

test("contrato: levantamento abaixo do mínimo é recusado", async () => {
  const repos = await setup("financas@levaja.ao");
  const provider = (await repos.providers.list({ pageSize: 50 })).items.find((item) => item.balance > 50_000);
  assert.ok(provider);
  await rejectsWith(repos.finance.requestWithdrawal(provider.id, 1000), "validation");
});

test("contrato: a matriz de permissões aplica-se a seguir à alteração", async () => {
  const repos = await setup();
  await rejectsWith((await setup("operacoes@levaja.ao")).settings.rolePermissions(), "forbidden");
  const matrix = await repos.settings.rolePermissions();
  await repos.settings.updateRolePermissions(
    { ...matrix, operations: matrix.operations.filter((permission) => permission !== "requests.operate"), admin: [] },
    "Operações só consulta",
  );
  const saved = await repos.settings.rolePermissions();
  assert.ok(saved.admin.includes("users.manage"));
  await repos.auth.logout();
  const session = await repos.auth.login("operacoes@levaja.ao", "123456");
  assert.equal(session.rolePermissions?.operations.includes("requests.operate"), false);
  const searching = (await repos.requests.list({ status: ["searching"], pageSize: 1 })).items[0];
  await rejectsWith(repos.requests.cancel(searching.id, "Sem permissão"), "forbidden");
});
