import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockAutomations } from "@/data/crm/mock/automations";
import { isRepositoryError } from "@/data/crm/repositories";
import { useAutomationsStore } from "@/stores/automations-store";

function repo() {
  return createMockAutomations(0);
}

test("create acrescenta uma automação em rascunho e remove elimina-a", async () => {
  const automations = repo();
  const before = (await automations.list()).length;
  const automation = await automations.create();
  assert.equal(automation.status, "Rascunho");
  assert.equal((await automations.list()).length, before + 1);
  const removed = await automations.remove(automation.id);
  assert.equal(removed.id, automation.id);
  assert.equal((await automations.list()).length, before);
});

test("remove falha se a automação não está em rascunho", async () => {
  const automations = repo();
  const automation = await automations.create();
  useAutomationsStore.setState((state) => ({
    automations: state.automations.map((item) => (item.id === automation.id ? { ...item, status: "Ativa", steps: item.steps } : item)),
  }));
  await assert.rejects(automations.remove(automation.id), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "invalid_transition");
    return true;
  });
});

test("setStatus recusa ativar uma automação incompleta", async () => {
  const automations = repo();
  const automation = await automations.create();
  useAutomationsStore.setState((state) => ({
    automations: state.automations.map((item) =>
      item.id === automation.id
        ? { ...item, steps: item.steps.map((step) => ({ ...step, action: "notificar-gestor" as const, message: "" })) }
        : item,
    ),
  }));
  await assert.rejects(automations.setStatus(automation.id, "Ativa"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "validation");
    return true;
  });
});

test("setStatus de id inexistente devolve not_found", async () => {
  const automations = repo();
  await assert.rejects(automations.setStatus("aut-inexistente", "Pausada"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});
