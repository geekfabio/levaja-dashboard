import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTOMATIONS, blankStep, DEFAULT_CONDITIONS, DEFAULT_TRIGGER, type Automation } from "@/data/automations";
import { COMPANIES, EMPTY_PROFILE, type Company } from "@/data/companies";
import type { DiscountOffer } from "@/data/discount-offers";
import { dueSteps, offerStatus } from "@/lib/automation-engine";

const company: Company = { ...COMPANIES[0], id: "cliente-teste", archived: false };

function automation(patch: Partial<Automation>): Automation {
  return {
    id: "aut-teste",
    name: "Teste",
    status: "Ativa",
    trigger: { ...DEFAULT_TRIGGER },
    conditions: { ...DEFAULT_CONDITIONS },
    steps: [blankStep("s1", "criar-tarefa"), { ...blankStep("s2", "notificar-gestor"), waitDays: 7, message: "x" }],
    enrolled: 0,
    completed: 0,
    activatedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...patch,
  };
}

test("automação pausada ou cliente arquivado não corre", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "cliente-criado" } });
  const events = [{ id: "e1", type: "cliente-criado" as const, companyId: company.id, date: "2026-10-13" }];
  assert.equal(dueSteps({ automations: [rule], companies: [company], events, today: "2026-10-13", done: new Set() }).length, 1);
  assert.equal(dueSteps({ automations: [{ ...rule, status: "Pausada" }], companies: [company], events, today: "2026-10-13", done: new Set() }).length, 0);
  assert.equal(dueSteps({ automations: [rule], companies: [{ ...company, archived: true }], events, today: "2026-10-13", done: new Set() }).length, 0);
});
test("acontecimentos: cliente criado e fase alterada só depois da ativação", () => {
  const created = automation({ trigger: { ...DEFAULT_TRIGGER, type: "cliente-criado" }, activatedAt: "2026-10-01" });
  const stage = automation({ id: "aut-fase", trigger: { ...DEFAULT_TRIGGER, type: "fase-alterada", stage: "Proposta" } });
  const events = [
    { id: "e1", type: "cliente-criado" as const, companyId: company.id, date: "2026-09-20" },
    { id: "e2", type: "cliente-criado" as const, companyId: company.id, date: "2026-10-13" },
    { id: "e3", type: "fase-alterada" as const, companyId: company.id, date: "2026-10-13", stage: "Negociação" },
  ];
  const due = dueSteps({ automations: [created, stage], companies: [company], events, today: "2026-10-13", done: new Set() });
  assert.deepEqual(due.map((item) => item.key), ["aut-teste|cliente-teste|e2|s1"]);
});

test("aniversário usa a data de cliente desde, uma vez por ano", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "aniversario" } });
  const withSince = { ...company, profile: { ...EMPTY_PROFILE, customerSince: "2020-10-13" } };
  const due = dueSteps({ automations: [rule], companies: [withSince], today: "2026-10-13", done: new Set() });
  assert.equal(due[0].key, "aut-teste|cliente-teste|2026|s1");
  assert.equal(dueSteps({ automations: [rule], companies: [withSince], today: "2026-10-12", done: new Set() }).length, 0);
});

test("proposta de desconto expira depois da validade", () => {
  const offer: DiscountOffer = {
    id: "of",
    companyId: company.id,
    percent: 10,
    scope: "Categorias habituais",
    categories: ["Bebidas"],
    createdAt: "2026-10-01T10:00",
    validUntil: "2026-10-15",
    status: "Por apresentar",
    owner: "Sara Neto",
    origin: "Teste",
  };
  assert.equal(offerStatus(offer, "2026-10-15"), "Por apresentar");
  assert.equal(offerStatus(offer, "2026-10-16"), "Expirada");
});

test("automações de exemplo têm passos válidos", () => {
  for (const item of AUTOMATIONS) assert.ok(item.steps.length > 0, item.name);
});
