import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/crm/mock";
import { isRepositoryError } from "@/data/crm/repositories";
import type { OpportunityDraft } from "@/data/crm/repositories";

function repos() {
  return createMockRepositories({ latencyMs: 0 });
}

const DRAFT: OpportunityDraft = {
  companyId: "nova-vida",
  companyName: "Supermercado Nova Vida",
  contactName: "Pedro Muanza",
  value: 5_000_000,
  stage: "Qualificação",
  probability: 30,
  expectedCloseDate: "2026-12-01",
  owner: "Sara Neto",
  products: ["Bebidas"],
};

test("create gera id e cronograma de fase inicial", async () => {
  const crm = repos();
  const before = (await crm.opportunities.list()).length;
  const opportunity = await crm.opportunities.create(DRAFT);
  assert.match(opportunity.id, /^op-/);
  assert.equal(opportunity.stageHistory.length, 1);
  assert.equal(opportunity.stageHistory[0].stage, "Qualificação");
  assert.equal((await crm.opportunities.list()).length, before + 1);
});

test("create recusa contacto vazio", async () => {
  const crm = repos();
  await assert.rejects(crm.opportunities.create({ ...DRAFT, contactName: "  " }), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "validation");
    return true;
  });
});

test("update aplica o patch", async () => {
  const crm = repos();
  const created = await crm.opportunities.create(DRAFT);
  const updated = await crm.opportunities.update(created.id, { value: 9_000_000, owner: "Jaime Teixeira" });
  assert.equal(updated.value, 9_000_000);
  assert.equal(updated.owner, "Jaime Teixeira");
});

test("moveStage para Ganha fixa 100% e regista histórico", async () => {
  const crm = repos();
  const created = await crm.opportunities.create(DRAFT);
  const won = await crm.opportunities.moveStage(created.id, "Fechada - Ganha");
  assert.equal(won.stage, "Fechada - Ganha");
  assert.equal(won.probability, 100);
  assert.equal(won.stageHistory.at(-1)?.stage, "Fechada - Ganha");
});

test("moveStage para Perdida exige motivo e fixa 0%", async () => {
  const crm = repos();
  const created = await crm.opportunities.create(DRAFT);
  await assert.rejects(crm.opportunities.moveStage(created.id, "Fechada - Perdida"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "validation");
    return true;
  });
  const lost = await crm.opportunities.moveStage(created.id, "Fechada - Perdida", "Preço");
  assert.equal(lost.probability, 0);
  assert.equal(lost.lossReason, "Preço");
});
