import { test } from "node:test";
import assert from "node:assert/strict";
import { blankStep, DEFAULT_CONDITIONS, DEFAULT_TRIGGER, type Automation } from "@/data/automations";
import { COMPANIES, EMPTY_PROFILE, type Company } from "@/data/companies";
import type { Sale } from "@/data/sales";
import { dueSteps, simulateTrigger } from "@/lib/automation-engine";

const company: Company = { ...COMPANIES[0], id: "cliente-teste", archived: false };

function automation(patch: Partial<Automation>): Automation {
  return {
    id: "aut-teste",
    name: "Teste",
    status: "Ativa",
    trigger: { ...DEFAULT_TRIGGER },
    conditions: { ...DEFAULT_CONDITIONS },
    steps: [blankStep("s1", "criar-tarefa")],
    enrolled: 0,
    completed: 0,
    activatedAt: "2026-10-01",
    updatedAt: "2026-10-01",
    ...patch,
  };
}

test("cliente muda de fase: só dispara para a fase escolhida", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "cliente-muda-fase", clientStage: "Reactivação" } });
  const events = [
    { id: "a", type: "cliente-muda-fase" as const, companyId: company.id, date: "2026-10-13", stage: "Expansão" },
    { id: "b", type: "cliente-muda-fase" as const, companyId: company.id, date: "2026-10-13", stage: "Reactivação" },
  ];
  const due = dueSteps({ automations: [rule], companies: [company], sales: [], events, today: "2026-10-14", done: new Set() });
  assert.deepEqual(due.map((item) => item.key), ["aut-teste|cliente-teste|b|s1"]);
});

test("oportunidade ganha e perdida são gatilhos diferentes", () => {
  const won = automation({ trigger: { ...DEFAULT_TRIGGER, type: "oportunidade-ganha" } });
  const events = [{ id: "p", type: "oportunidade-perdida" as const, companyId: company.id, date: "2026-10-13" }];
  assert.equal(dueSteps({ automations: [won], companies: [company], sales: [], events, today: "2026-10-14", done: new Set() }).length, 0);
});

test("simulação do aniversário mostra os próximos 30 dias", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "aniversario" } });
  const companies = [
    { ...company, id: "a", profile: { ...EMPTY_PROFILE, customerSince: "2019-10-20" } },
    { ...company, id: "b", profile: { ...EMPTY_PROFILE, customerSince: "2019-12-20" } },
    { ...company, id: "c", profile: { ...EMPTY_PROFILE, customerSince: "" } },
  ];
  const result = simulateTrigger(rule, companies, [], [], "2026-10-14");
  assert.equal(result.mode, "aniversario");
  assert.deepEqual(result.entries.map((entry) => [entry.company.id, entry.label]), [["a", "7 anos a 20/10"]]);
  assert.equal(result.withoutHistory, 1);
});

test("simulação da dívida vencida mostra a fatura mais antiga por pagar", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "divida-vencida", days: 30 } });
  const sale: Sale = {
    id: "v",
    document: "FR 2026/1",
    at: "2026-09-01T10:00",
    channel: "Entrega",
    payment: "Crédito",
    companyId: company.id,
    lines: [],
    total: 1000,
    paid: false,
    source: "Simulação",
  };
  const result = simulateTrigger(rule, [company], [sale], [], "2026-10-14");
  assert.equal(result.entries[0].label, "FR 2026/1 por pagar há 43 dias");
});

test("simulação de acontecimentos lista os dos últimos 30 dias", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "cliente-criado" } });
  const events = [
    { id: "x", type: "cliente-criado" as const, companyId: company.id, date: "2026-10-12" },
    { id: "y", type: "cliente-criado" as const, companyId: company.id, date: "2026-08-01" },
  ];
  const result = simulateTrigger(rule, [company], [], events, "2026-10-14");
  assert.deepEqual(result.entries.map((entry) => entry.label), ["Cliente criado · 12/10"]);
});
