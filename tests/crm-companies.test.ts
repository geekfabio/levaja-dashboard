import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockCompanies } from "@/data/crm/mock/companies";
import { isRepositoryError } from "@/data/crm/repositories";
import { useCompaniesStore } from "@/stores/companies-store";

function repo() {
  return createMockCompanies(0);
}

function seedCompany() {
  return useCompaniesStore.getState().companies[0];
}

test("list devolve a colecção actual da store e cópias defensivas", async () => {
  const companies = repo();
  const first = await companies.list();
  assert.ok(first.length > 0);
  const originalName = first[0].name;
  first[0].name = "alterado localmente";
  const second = await companies.list();
  assert.equal(second[0].name, originalName);
});

test("get de id inexistente devolve not_found", async () => {
  const companies = repo();
  await assert.rejects(companies.get("empresa-inexistente"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("create recusa nome vazio e acrescenta à store partilhada", async () => {
  const companies = repo();
  const before = (await companies.list()).length;
  await assert.rejects(
    companies.create({
      id: "x",
      name: "   ",
      tags: [],
      owner: "Sara Neto",
      zone: "Luanda",
      openDeals: 0,
      pipelineValue: 0,
      winProbability: 0,
      trend: [],
      lastInteraction: { date: "2026-10-01", label: "Criado" },
      activityDays: 0,
    }),
    (error: unknown) => {
      assert.ok(isRepositoryError(error));
      assert.equal(error.code, "validation");
      return true;
    },
  );
  const created = await companies.create({
    id: "cliente-teste",
    name: "Cliente de teste",
    tags: [],
    owner: "Sara Neto",
    zone: "Luanda",
    openDeals: 0,
    pipelineValue: 0,
    winProbability: 0,
    trend: [],
    lastInteraction: { date: "2026-10-01", label: "Criado" },
    activityDays: 0,
  });
  assert.equal(created.name, "Cliente de teste");
  assert.equal((await companies.list()).length, before + 1);
  assert.ok(useCompaniesStore.getState().companies.some((item) => item.id === "cliente-teste"));
});

test("update aplica o patch na store partilhada", async () => {
  const companies = repo();
  const target = seedCompany();
  const updated = await companies.update(target.id, { owner: "Jaime Teixeira" });
  assert.equal(updated.owner, "Jaime Teixeira");
  assert.equal(useCompaniesStore.getState().companies.find((item) => item.id === target.id)?.owner, "Jaime Teixeira");
});

test("updateMany só afecta os ids indicados", async () => {
  const companies = repo();
  const [first, second] = useCompaniesStore.getState().companies;
  const affected = await companies.updateMany([first.id], { zone: "Benguela" });
  assert.equal(affected.length, 1);
  assert.equal(affected[0].zone, "Benguela");
  assert.notEqual(useCompaniesStore.getState().companies.find((item) => item.id === second.id)?.zone, "Benguela");
});

test("archive marca archived e restore repõe o snapshot", async () => {
  const companies = repo();
  const target = seedCompany();
  const snapshot = structuredClone(target);
  await companies.archive([target.id]);
  assert.equal(useCompaniesStore.getState().companies.find((item) => item.id === target.id)?.archived, true);
  await companies.restore([snapshot]);
  assert.equal(useCompaniesStore.getState().companies.find((item) => item.id === target.id)?.archived, undefined);
});

test("scheduleFollowUp define e remove o próximo contacto", async () => {
  const companies = repo();
  const target = seedCompany();
  const scheduled = await companies.scheduleFollowUp(target.id, { date: "2026-12-01", type: "Chamada", note: "", owner: target.owner });
  assert.deepEqual(scheduled.nextFollowUp, { date: "2026-12-01", type: "Chamada", note: "", owner: target.owner });
  const cleared = await companies.scheduleFollowUp(target.id, null);
  assert.equal(cleared.nextFollowUp, undefined);
});

test("registerContact actualiza a última interacção só se mais recente", async () => {
  const companies = repo();
  const target = seedCompany();
  const oldDate = "2000-01-01";
  await companies.registerContact(target.id, oldDate, "Chamada");
  assert.notEqual(useCompaniesStore.getState().companies.find((item) => item.id === target.id)?.lastInteraction.date, oldDate);
});
