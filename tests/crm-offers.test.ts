import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockOffers } from "@/data/crm/mock/offers";
import { isRepositoryError } from "@/data/crm/repositories";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";

function repo() {
  return createMockOffers(0);
}

const INPUT = { companyId: "boa-esperanca", percent: 10, scope: "Toda a encomenda" as const, validDays: 14 };

test("create acrescenta uma proposta e substitui as propostas abertas do cliente", async () => {
  const offers = repo();
  const first = await offers.create(INPUT, "2026-10-28");
  assert.equal(first.companyId, "boa-esperanca");
  assert.equal(first.status, "Por apresentar");
  const second = await offers.create(INPUT, "2026-10-28");
  const stored = useAutomationRunsStore.getState().offers;
  assert.equal(stored.find((item) => item.id === first.id)?.status, "Substituída");
  assert.equal(stored.find((item) => item.id === second.id)?.status, "Por apresentar");
});

test("create falha para um cliente inexistente", async () => {
  const offers = repo();
  await assert.rejects(offers.create({ ...INPUT, companyId: "cliente-inexistente" }, "2026-10-28"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("setStatus altera o estado da proposta", async () => {
  const offers = repo();
  const offer = await offers.create(INPUT, "2026-10-28");
  const updated = await offers.setStatus(offer.id, "Apresentada");
  assert.equal(updated.status, "Apresentada");
});

test("setStatus de id inexistente devolve not_found", async () => {
  const offers = repo();
  await assert.rejects(offers.setStatus("of-inexistente", "Recusada"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});
