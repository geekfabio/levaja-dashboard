import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { csatStats, privacyUrgency, ticketResponseSla, webhookUrlIssue } from "@/lib/leva-ja/trust";

const NOW = new Date("2026-10-22T13:30:00.000Z");

function create() {
  return createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
}

async function setup(email = "admin@levaja.ao") {
  const repos = create();
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

test("confiança: prazos de resposta, satisfação, prazos legais e endereços de webhook", () => {
  const now = NOW.getTime();
  const hours = { urgent: 1, high: 4, medium: 12, low: 24 };
  const base = { priority: "high" as const, createdAt: new Date(now - 2 * 3_600_000).toISOString() };
  assert.equal(ticketResponseSla({ ...base, messages: [] }, hours, now).status, "pending");
  assert.equal(ticketResponseSla({ ...base, createdAt: new Date(now - 3.5 * 3_600_000).toISOString(), messages: [] }, hours, now).status, "at_risk");
  assert.equal(ticketResponseSla({ ...base, createdAt: new Date(now - 5 * 3_600_000).toISOString(), messages: [] }, hours, now).status, "breached");
  const replied = [{ id: "m", author: "admin" as const, authorName: "A", body: "Olá", at: new Date(now - 3_600_000).toISOString() }];
  assert.equal(ticketResponseSla({ ...base, messages: replied }, hours, now).status, "met");
  assert.deepEqual(csatStats([5, 4, 2, 5]), { responses: 4, average: 4, satisfiedRate: 0.75 });
  assert.equal(privacyUrgency({ dueAt: new Date(now - 1000).toISOString(), status: "received" }, now), "overdue");
  assert.equal(privacyUrgency({ dueAt: new Date(now + 3 * 86_400_000).toISOString(), status: "in_progress" }, now), "due_soon");
  assert.equal(privacyUrgency({ dueAt: new Date(now - 1000).toISOString(), status: "completed" }, now), "closed");
  assert.ok(webhookUrlIssue("http://erp.exemplo.ao/hook"));
  assert.ok(webhookUrlIssue("https://192.168.1.10/hook"));
  assert.ok(webhookUrlIssue("não é endereço"));
  assert.equal(webhookUrlIssue("https://erp.exemplo.ao/hook"), null);
});

test("suporte: resumo dos prazos de resposta e satisfação dos clientes", async () => {
  const repos = await setup("suporte@levaja.ao");
  const summary = await repos.support.responseSummary();
  assert.ok(summary.metRate === null || (summary.metRate >= 0 && summary.metRate <= 1));
  const satisfaction = await repos.support.satisfaction();
  assert.ok(satisfaction.responses > 0);
  assert.ok((satisfaction.average ?? 0) >= 1 && (satisfaction.average ?? 0) <= 5);
  assert.ok((satisfaction.responseRate ?? 0) > 0 && (satisfaction.responseRate ?? 0) <= 1);
});

test("segurança: segundo factor, sessões terminadas à distância e registo de acessos", async () => {
  const repos = create();
  await rejectsWith(repos.auth.login("nelson.cardoso@levaja.ao", "123456"), "unauthorized");
  await rejectsWith(repos.auth.login("nelson.cardoso@levaja.ao", "123456", "000000"), "unauthorized");
  const nelson = await repos.auth.login("nelson.cardoso@levaja.ao", "123456", "246810");
  assert.equal(nelson.user.email, "nelson.cardoso@levaja.ao");
  await repos.auth.logout();
  await repos.auth.login("admin@levaja.ao", "123456");
  const log = await repos.security.accessLog({ pageSize: 5 });
  assert.equal(log.items[0].result, "success");
  assert.ok((await repos.security.accessLog({ result: ["two_factor_failed"], pageSize: 50 })).items.some((entry) => entry.email === "nelson.cardoso@levaja.ao"));
  const sessions = await repos.security.sessions();
  const own = sessions.find((session) => session.current);
  assert.ok(own);
  await rejectsWith(repos.security.revokeSession(own.id, "Teste"), "validation");
  const other = sessions.find((session) => !session.current);
  assert.ok(other);
  const after = await repos.security.revokeSession(other.id, "Dispositivo perdido");
  assert.ok(after.every((session) => session.id !== other.id));
  const users = await repos.auth.listUsers();
  const support = users.find((user) => user.email === "suporte@levaja.ao");
  assert.ok(support);
  const updated = await repos.security.setTwoFactor(support.id, true, "Política nova");
  assert.equal(updated.twoFactorEnabled, true);
  await repos.auth.logout();
  await rejectsWith(repos.auth.login("suporte@levaja.ao", "123456"), "unauthorized");
  await repos.auth.login("suporte@levaja.ao", "123456", "246810");
  await rejectsWith(repos.security.sessions(), "forbidden");
});

test("protecção de dados: tratar, exportar, eliminar e recusar com prazos", async () => {
  const repos = await setup("suporte@levaja.ao");
  const summary = await repos.privacy.summary();
  assert.ok(summary.open >= 3 && summary.overdue >= 1);
  const list = await repos.privacy.list({ pageSize: 20 });
  const access = list.items.find((request) => request.kind === "access" && request.status === "received");
  assert.ok(access);
  await repos.privacy.start(access.id);
  await rejectsWith(repos.privacy.start(access.id), "invalid_transition");
  const exported = await repos.privacy.exportData(access.id);
  assert.ok(exported.data.perfil && Array.isArray(exported.data.pedidos));
  await repos.privacy.complete(access.id, "Exportação enviada por e-mail ao titular.");
  const erasure = list.items.find((request) => request.kind === "erasure");
  assert.ok(erasure);
  await rejectsWith(repos.privacy.exportData(erasure.id), "validation");
  await repos.privacy.complete(erasure.id, "Dados apagados e conta anonimizada.");
  const client = await repos.clients.get(erasure.subjectId);
  assert.match(client.name, /^Titular removido/);
  assert.equal(client.email, "");
  await rejectsWith(repos.privacy.reject(erasure.id, "Tarde"), "invalid_transition");
});

test("integrações: chaves de API, webhooks e teste só simulado", async () => {
  const repos = await setup();
  assert.equal((await repos.integrations.keys()).length, 3);
  await rejectsWith(repos.integrations.createKey("ERP", [], null), "validation");
  const created = await repos.integrations.createKey("ERP novo", ["requests.read"], 90);
  assert.match(created.secret, /^lj_live_[a-z0-9]{28}$/);
  assert.equal(created.item.prefix, created.secret.slice(0, 12));
  assert.ok(!JSON.stringify(await repos.integrations.keys()).includes(created.secret));
  const revoked = await repos.integrations.revokeKey(created.item.id, "Teste");
  assert.ok(revoked.revokedAt);
  await rejectsWith(repos.integrations.revokeKey(created.item.id, "Outra vez"), "invalid_transition");
  await rejectsWith(repos.integrations.createWebhook({ url: "http://interno.local/x", description: "", events: ["request.created"] }), "validation");
  const webhook = await repos.integrations.createWebhook({ url: "https://parceiro.ao/hooks", description: "Parceiro", events: ["request.created"] });
  assert.match(webhook.secret, /^whsec_/);
  const delivery = await repos.integrations.testWebhook(webhook.item.id);
  assert.equal(delivery.simulated, true);
  await repos.integrations.setWebhookActive(webhook.item.id, false);
  await rejectsWith(repos.integrations.testWebhook(webhook.item.id), "invalid_transition");
  const support = await setup("suporte@levaja.ao");
  await rejectsWith(support.integrations.keys(), "forbidden");
});
