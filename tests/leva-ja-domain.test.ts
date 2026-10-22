import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { defaultPricingConfig, estimatePrice, priceWithProposal, validatePricingConfig } from "@/lib/leva-ja/pricing";
import { canCancel, canTransition, nextStatus, STATUS_LABELS } from "@/lib/leva-ja/status";
import { canAccessSection, hasPermission } from "@/lib/leva-ja/permissions";
import { generateSeed } from "@/data/leva-ja/mock/seed";
import { createMockRepositories } from "@/data/leva-ja/mock";

const NOW = new Date("2026-10-22T13:30:00.000Z");
const config = defaultPricingConfig("2026-10-01T00:00:00.000Z");

test("formatação: Kz com espaço nos milhares e datas dd/MM/yyyy HH:mm em Luanda", () => {
  assert.equal(formatKz(12500).replace(/ /g, " "), "12 500 Kz");
  assert.equal(formatKz(1250000).replace(/ /g, " "), "1 250 000 Kz");
  assert.equal(formatKz(500).replace(/ /g, " "), "500 Kz");
  assert.equal(formatDateTimeNumeric("2026-10-22T23:15:00.000Z"), "23/10/2026 00:15");
  assert.equal(formatDateTimeNumeric("2026-01-05T08:07:00.000Z"), "05/01/2026 09:07");
});

test("preço: base + km × preço/km + extras, arredondado a 500 Kz", () => {
  const tow = estimatePrice(config, { kind: "tow", distanceKm: 10 });
  assert.equal(tow.serviceValue, 10500);
  assert.equal(tow.breakdown.total, 11000);
  assert.equal(tow.commission, 1575);
  assert.equal(tow.providerEarning, 8925);
  assert.equal(tow.platformRevenue, 2075);
  const move = estimatePrice(config, { kind: "house_move", distanceKm: 7.3, extrasAmount: 4500 });
  assert.equal(move.serviceValue, 25500);
  const { base, distance, extras, platformFee, total } = move.breakdown;
  assert.equal(base + distance + extras + platformFee, total);
  const proposal = priceWithProposal(config, move, 31_200);
  assert.equal(proposal.serviceValue, 31000);
  assert.equal(proposal.breakdown.base + proposal.breakdown.distance + proposal.breakdown.extras + proposal.breakdown.platformFee, proposal.breakdown.total);
});

test("preço: validação recusa valores inválidos", () => {
  assert.equal(validatePricingConfig(config).length, 0);
  assert.ok(validatePricingConfig({ ...config, commissionRate: 0.9 }).length > 0);
  assert.ok(validatePricingConfig({ ...config, rules: config.rules.slice(1) }).length > 0);
});

test("máquina de estados: sequência fixa e cancelamento só no início", () => {
  assert.equal(nextStatus("searching"), "assigned");
  assert.equal(nextStatus("rated"), null);
  assert.equal(canTransition("assigned", "arrived"), false);
  assert.equal(canTransition("arrived", "cancelled"), true);
  assert.equal(canCancel("pickup_confirmed"), false);
  assert.equal(STATUS_LABELS.rated, "Concluído");
});

test("permissões: cada papel só vê as suas secções", () => {
  assert.equal(canAccessSection("finance", "finance"), true);
  assert.equal(canAccessSection("finance", "documents"), false);
  assert.equal(canAccessSection("support", "support"), true);
  assert.equal(canAccessSection("operations", "users"), false);
  assert.equal(hasPermission("admin", "users.manage"), true);
});

test("gerador: semente fixa, volumes e coerência", () => {
  const seed = generateSeed(NOW);
  assert.equal(JSON.stringify(seed), JSON.stringify(generateSeed(NOW)));
  assert.equal(seed.requests.length, 300);
  assert.equal(seed.clients.length, 40);
  assert.equal(seed.providers.length, 25);
  assert.equal(seed.sos.filter((alert) => alert.status === "open").length, 2);
  assert.equal(seed.withdrawals.filter((withdrawal) => withdrawal.status === "pending").length, 6);
  assert.equal(seed.clients.filter((client) => client.blocked).length, 2);
  assert.ok(seed.audit.length >= 25);
  assert.ok(seed.tickets.length >= 20);
  const stalled = seed.requests.filter((request) => request.status === "searching" && NOW.getTime() - Date.parse(request.createdAt) >= 15 * 60_000);
  assert.ok(stalled.length >= 3);
  for (const request of seed.requests) {
    const { base, distance, extras, platformFee, total } = request.price;
    assert.equal(base + distance + extras + platformFee, total, request.code);
    assert.equal((total - platformFee) % 500, 0, request.code);
    assert.ok(request.timeline.every((event) => Date.parse(event.at) <= NOW.getTime()), request.code);
    assert.ok(/^\+244 9\d{2} \d{3} \d{3}$/.test(seed.clients.find((client) => client.id === request.clientId)?.phone ?? ""));
  }
  assert.ok(seed.providers.every((provider) => /^LD-\d{2}-\d{2}-[A-Z]{2}$/.test(provider.vehicle.plate)));
});

test("reposição: repor os dados volta ao estado da semente", async () => {
  const repos = createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
  await repos.auth.login("admin@levaja.ao", "123456");
  const request = (await repos.requests.list({ status: ["searching"], pageSize: 1 })).items[0];
  await repos.requests.cancel(request.id, "Teste de reposição");
  await repos.demo?.reset();
  assert.equal((await repos.requests.get(request.id)).status, "searching");
  const audit = await repos.audit.list({ pageSize: 1 });
  assert.equal(audit.items[0].action, "demo.reset");
});
