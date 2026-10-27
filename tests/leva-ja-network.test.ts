import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { applicationBlocker, isPenaltyActive, nextApplicationStage, penaltyIssues, qualityScore } from "@/lib/leva-ja/quality";

const NOW = new Date("2026-10-22T13:30:00.000Z");

async function setup(email = "operacoes@angoleva.ao") {
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

test("rede: regras puras de candidatura, qualidade e penalização", () => {
  assert.equal(nextApplicationStage("submitted"), "documents");
  assert.equal(nextApplicationStage("inspection"), null);
  const now = NOW.getTime();
  assert.match(applicationBlocker({ stage: "documents", documentsReceived: ["id"], interviewAt: undefined, inspection: undefined }, now) ?? "", /Faltam 3/);
  assert.equal(applicationBlocker({ stage: "interview", documentsReceived: [], interviewAt: new Date(now + 3600_000).toISOString(), inspection: undefined }, now), "A entrevista ainda não aconteceu.");
  assert.equal(applicationBlocker({ stage: "inspection", documentsReceived: [], interviewAt: undefined, inspection: { passed: true, notes: "ok", at: "", by: "" } }, now), null);
  const good = qualityScore({ completed: 20, cancelled: 0, arrivals: [10, 12, 9], ratings: [5, 5, 4], disputes: 0, joinedDaysAgo: 200, active: true }, { arrivalTargetMinutes: 25, cancelLimit: 3 });
  const bad = qualityScore({ completed: 5, cancelled: 4, arrivals: [40, 50, 10], ratings: [2, 3, 2], disputes: 2, joinedDaysAgo: 200, active: true }, { arrivalTargetMinutes: 25, cancelLimit: 3 });
  assert.ok(good.score > 90 && good.flags.length === 0);
  assert.ok(bad.score < 40);
  assert.deepEqual(bad.flags, ["low_rating", "cancellations", "late_arrivals", "disputes"]);
  assert.equal(penaltyIssues({ kind: "fine", reason: "Cobrança indevida", amount: 0 })[0].field, "amount");
  assert.equal(penaltyIssues({ kind: "suspension", reason: "Cancelamentos", days: 120 })[0].field, "days");
  assert.equal(isPenaltyActive({ kind: "suspension", until: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(isPenaltyActive({ kind: "fine", revokedAt: "2026-10-01T00:00:00.000Z" }, now), false);
});

test("candidaturas: percurso completo até criar o prestador com documentos por validar", async () => {
  const repos = await setup();
  const summary = await repos.applications.summary();
  assert.ok(summary.open > 0);
  assert.equal(summary.funnel[0].count, (await repos.applications.list({ pageSize: 100 })).total);
  assert.ok(summary.funnel.every((item, index) => index === 0 || item.count <= summary.funnel[index - 1].count));
  const fresh = (await repos.applications.list({ stage: ["submitted"], pageSize: 1 })).items[0];
  await repos.applications.advance(fresh.id);
  await rejectsWith(repos.applications.advance(fresh.id), "validation");
  for (const icon of ["id", "license", "vehicle", "insurance"] as const) await repos.applications.receiveDocument(fresh.id, icon);
  const interview = await repos.applications.advance(fresh.id, "Documentos completos");
  assert.equal(interview.stage, "interview");
  await rejectsWith(repos.applications.advance(fresh.id), "validation");
  await repos.applications.scheduleInterview(fresh.id, "2026-10-22T09:00:00.000Z");
  const inspection = await repos.applications.advance(fresh.id);
  assert.equal(inspection.stage, "inspection");
  await rejectsWith(repos.applications.approve(fresh.id, "Tudo certo"), "validation");
  await rejectsWith(repos.applications.recordInspection(fresh.id, true, ""), "validation");
  await repos.applications.recordInspection(fresh.id, true, "Viatura conforme.");
  const approved = await repos.applications.approve(fresh.id, "Candidatura completa.");
  assert.equal(approved.stage, "approved");
  assert.ok(approved.providerId);
  const provider = await repos.providers.get(approved.providerId);
  assert.equal(provider.accountStatus, "pending_approval");
  assert.ok(provider.documents.every((document) => document.state === "pending"));
  const queue = await repos.documents.queue({ pageSize: 200 });
  assert.ok(queue.items.some((item) => item.providerId === provider.id));
  await rejectsWith(repos.applications.reject(fresh.id, "Tarde"), "invalid_transition");
  await as(repos, "suporte@angoleva.ao");
  await rejectsWith(repos.applications.list(), "forbidden");
});

test("frotas: estatísticas, motoristas e suspensão", async () => {
  const repos = await setup();
  const fleets = await repos.fleets.list();
  assert.equal(fleets.total, 3);
  const active = fleets.items.find((fleet) => fleet.status === "active" && fleet.stats.drivers > 0);
  assert.ok(active);
  const detail = await repos.fleets.get(active.id);
  assert.equal(detail.drivers.length, detail.stats.drivers);
  const providers = await repos.providers.list({ pageSize: 100 });
  const loose = providers.items.find((provider) => !provider.fleetId && provider.accountStatus === "active");
  assert.ok(loose);
  const added = await repos.fleets.addDriver(active.id, loose.id);
  assert.equal(added.stats.drivers, detail.stats.drivers + 1);
  const other = fleets.items.find((fleet) => fleet.id !== active.id && fleet.status === "active");
  if (other) await rejectsWith(repos.fleets.addDriver(other.id, loose.id), "validation");
  await rejectsWith(repos.fleets.removeDriver(active.id, loose.id, ""), "validation");
  await repos.fleets.removeDriver(active.id, loose.id, "Saiu da empresa");
  await rejectsWith(repos.fleets.create({ name: "X", nif: "12", contactName: "", phone: "123", email: "x" }), "validation");
  const created = await repos.fleets.create({ name: "Cargas do Sul", nif: "5401234567", contactName: "Rui Sambo", phone: "923456789", email: "Geral@CargasDoSul.ao" });
  assert.equal(created.phone, "+244 923 456 789");
  assert.equal(created.email, "geral@cargasdosul.ao");
  const suspended = await repos.fleets.setStatus(created.id, "suspended", "Documentação em falta");
  assert.equal(suspended.status, "suspended");
  await rejectsWith(repos.fleets.addDriver(created.id, loose.id), "invalid_transition");
  await as(repos, "suporte@angoleva.ao");
  await rejectsWith(repos.fleets.list(), "forbidden");
});

test("qualidade e penalizações: multa sai da carteira, suspensão temporária e anulação", async () => {
  const repos = await setup();
  const scores = await repos.quality.scores({ pageSize: 100 });
  assert.ok(scores.items.length > 0);
  assert.ok(scores.items.every((item, index) => index === 0 || scores.items[index - 1].score <= item.score));
  const seeded = await repos.quality.penalties({ pageSize: 20 });
  assert.ok(seeded.items.some((penalty) => penalty.kind === "suspension"));
  assert.ok(seeded.items.some((penalty) => penalty.revokedAt));

  const providers = await repos.providers.list({ pageSize: 100 });
  const target = providers.items.find((provider) => provider.accountStatus === "active" && provider.availability === "offline");
  assert.ok(target);
  const before = target.balance;
  await rejectsWith(repos.quality.penalize(target.id, { kind: "fine", reason: "Cobrança indevida" }), "validation");
  const fine = await repos.quality.penalize(target.id, { kind: "fine", reason: "Cobrança indevida", amount: 2000 });
  assert.equal((await repos.providers.get(target.id)).balance, before - 2000);
  await repos.quality.revoke(fine.id, "Engano na multa");
  assert.equal((await repos.providers.get(target.id)).balance, before);
  await rejectsWith(repos.quality.revoke(fine.id, "Outra vez"), "invalid_transition");

  const suspension = await repos.quality.penalize(target.id, { kind: "suspension", reason: "Cancelamentos repetidos", days: 3 });
  const suspended = await repos.providers.get(target.id);
  assert.equal(suspended.accountStatus, "suspended");
  assert.equal(suspended.suspendedUntil, suspension.until);
  await rejectsWith(repos.quality.penalize(target.id, { kind: "suspension", reason: "Outra", days: 2 }), "invalid_transition");
  await repos.quality.revoke(suspension.id, "Recurso aceite");
  assert.equal((await repos.providers.get(target.id)).accountStatus, "active");
  const quality = await repos.quality.provider(target.id);
  assert.equal(quality.activePenalties, 0);

  await as(repos, "suporte@angoleva.ao");
  await rejectsWith(repos.quality.penalize(target.id, { kind: "warning", reason: "Atraso" }), "forbidden");
});
