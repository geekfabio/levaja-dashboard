import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/leva-ja/mock";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";
import { claimIssues, dispatchStartsAt, isUpcoming, percentile, scheduleRisk, slaStats } from "@/lib/leva-ja/scheduling";

const NOW = new Date("2026-10-22T13:30:00.000Z");

async function setup(email = "operacoes@levaja.ao") {
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

test("operação: regras de agendamento, prazos e sinistros", () => {
  const now = NOW.getTime();
  const tomorrow = new Date(now + 24 * 3_600_000).toISOString();
  assert.equal(isUpcoming({ scheduledFor: tomorrow, status: "searching" }, now, 60), true);
  assert.equal(isUpcoming({ scheduledFor: new Date(now + 30 * 60_000).toISOString(), status: "searching" }, now, 60), false);
  assert.equal(isUpcoming({ scheduledFor: tomorrow, status: "in_transit" }, now, 60), false);
  assert.equal(scheduleRisk({ scheduledFor: new Date(now + 2 * 3_600_000).toISOString(), status: "searching", providerId: undefined }, now), true);
  assert.equal(scheduleRisk({ scheduledFor: new Date(now + 2 * 3_600_000).toISOString(), status: "assigned", providerId: "p" }, now), false);
  assert.equal(dispatchStartsAt({ createdAt: "2026-10-21T10:00:00.000Z", scheduledFor: tomorrow }, 60), now + 23 * 3_600_000);
  assert.equal(percentile([5, 1, 9, 3, 7, 2, 8, 4, 6, 10], 0.9), 9);
  assert.deepEqual(slaStats([5, 10, 20, 30], 15), { count: 4, withinRate: 0.5, average: 16, p90: 30, breaches: 2 });
  assert.deepEqual(slaStats([], 15), { count: 0, withinRate: null, average: null, p90: null, breaches: 0 });
  assert.deepEqual(claimIssues({ description: "Curto", estimatedAmount: 0, occurredAt: tomorrow }, now).map((issue) => issue.field), ["description", "estimatedAmount", "occurredAt"]);
});

test("agendados: ficam fora do mapa e da atribuição até à antecedência definida", async () => {
  const repos = await setup();
  const report = await repos.operations.scheduled({ days: 14 });
  assert.equal(report.items.length, 12);
  assert.ok(report.items.every((request, index) => index === 0 || (report.items[index - 1].scheduledFor ?? "") <= (request.scheduledFor ?? "")));
  assert.ok(report.totals.unassigned >= 1 && report.totals.risk >= 1);
  const risky = await repos.operations.scheduled({ state: "risk" });
  assert.ok(risky.items.every((request) => !request.providerId));
  const active = await repos.requests.active();
  const upcomingIds = new Set(report.items.filter((request) => Date.parse(request.scheduledFor ?? "") - NOW.getTime() > 60 * 60_000).map((request) => request.id));
  assert.ok(upcomingIds.size > 0);
  assert.ok(active.every((request) => !upcomingIds.has(request.id)));
  const attention = await repos.metrics.attention();
  assert.ok(attention.stalledSearching.every((request) => !upcomingIds.has(request.id)));
});

test("prazos: atribuição e chegada com metas das definições", async () => {
  const repos = await setup();
  const report = await repos.operations.sla({ from: "2026-09-23", to: "2026-10-22" });
  assert.equal(report.targets.assign, 8);
  assert.ok(report.assign.count > 50 && report.arrival.count > 50);
  assert.ok((report.assign.withinRate ?? 0) > 0 && (report.assign.withinRate ?? 0) <= 1);
  assert.equal(report.daily.length, 30);
  assert.ok(report.breaches.every((breach) => breach.minutes > breach.target));
  assert.equal(report.byZone.reduce((sum, zone) => sum + zone.assign.count, 0), report.assign.count);
});

test("mapa de calor: procura por pedidos e oferta por prestadores online", async () => {
  const repos = await setup();
  const demand = await repos.operations.heatmap({ kind: "demand", days: 7 });
  const total = demand.zones.reduce((sum, zone) => sum + zone.demand, 0);
  assert.equal(demand.points.reduce((sum, point) => sum + point.weight, 0), total);
  assert.equal(demand.max, Math.max(...demand.points.map((point) => point.weight)));
  const morning = await repos.operations.heatmap({ kind: "demand", days: 7, hour: 9 });
  assert.ok(morning.points.reduce((sum, point) => sum + point.weight, 0) <= total);
  const supply = await repos.operations.heatmap({ kind: "supply", days: 7 });
  const online = (await repos.providers.positions()).length;
  assert.equal(supply.points.reduce((sum, point) => sum + point.weight, 0), online);
});

test("sinistros: participar, analisar, aprovar e pagar com as permissões certas", async () => {
  const repos = await setup("suporte@levaja.ao");
  const seeded = await repos.claims.list({ pageSize: 20 });
  assert.equal(new Set(seeded.items.map((claim) => claim.status)).size, 5);
  const delivered = (await repos.requests.list({ status: ["rated"], pageSize: 5 })).items[0];
  assert.ok(delivered.photos?.some((photo) => photo.stage === "pickup") || delivered.photos === undefined);
  const searching = (await repos.requests.list({ status: ["searching"], pageSize: 1 })).items[0];
  await rejectsWith(repos.claims.report({ requestId: searching.id, kind: "cargo_damage", description: "Carga danificada na entrega", estimatedAmount: 10_000, occurredAt: NOW.toISOString() }), "invalid_transition");
  await rejectsWith(repos.claims.report({ requestId: delivered.id, kind: "cargo_damage", description: "Curto", estimatedAmount: 10_000, occurredAt: NOW.toISOString() }), "validation");
  const claim = await repos.claims.report({ requestId: delivered.id, kind: "cargo_damage", description: "Frigorífico amolgado na descarga", estimatedAmount: 40_000, occurredAt: "2026-10-22T10:00:00.000Z" });
  assert.equal(claim.status, "reported");
  await repos.claims.addNote(claim.id, "Cliente enviou fotografias.");
  await rejectsWith(repos.claims.startReview(claim.id, "Kianda", "AP-1"), "forbidden");
  await as(repos, "financas@levaja.ao");
  await rejectsWith(repos.claims.approve(claim.id, 30_000, "Confirmado"), "invalid_transition");
  await repos.claims.startReview(claim.id, "Kianda Seguros", "AP-2026-1");
  await rejectsWith(repos.claims.approve(claim.id, 90_000, "Confirmado"), "validation");
  const approved = await repos.claims.approve(claim.id, 32_000, "Dano confirmado");
  assert.equal(approved.approvedAmount, 32_000);
  await rejectsWith(repos.claims.markPaid(claim.id, ""), "validation");
  const paid = await repos.claims.markPaid(claim.id, "IND1");
  assert.equal(paid.status, "paid");
  await rejectsWith(repos.claims.addNote(claim.id, "Depois de pago"), "invalid_transition");
  assert.equal((await repos.claims.forRequest(delivered.id))[0].id, claim.id);
});
