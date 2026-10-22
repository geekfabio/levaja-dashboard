import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTOMATIONS, blankStep, DEFAULT_CONDITIONS, DEFAULT_TRIGGER, type Automation } from "@/data/automations";
import { COMPANIES, EMPTY_PROFILE, type Company } from "@/data/companies";
import type { DiscountOffer } from "@/data/discount-offers";
import type { Sale } from "@/data/sales";
import { dueSteps, offerDiscountValue, offerStatus } from "@/lib/automation-engine";
import { matchCustomer, purchaseStats } from "@/lib/sales";

const company: Company = { ...COMPANIES[0], id: "cliente-teste", archived: false };

function sale(at: string, total: number, extra: Partial<Sale> = {}): Sale {
  return {
    id: `vd-${at}`,
    document: `FR ${at}`,
    at,
    channel: "Loja Viana",
    payment: "Numerário",
    companyId: company.id,
    lines: [{ category: "Bebidas", description: "Sumo", quantity: 1, unitPrice: total }],
    total,
    paid: true,
    source: "Simulação",
    ...extra,
  };
}

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

test("identificação do cliente por cartão, NIF ou telefone, pela ordem escolhida", () => {
  const ids = { a: { card: "AA-1", nif: "5000000001", phone: "+244 923 000 001" } };
  assert.equal(matchCustomer({ type: "Cartão de cliente", value: "aa-1" }, ids, ["Cartão de cliente"]), "a");
  assert.equal(matchCustomer({ type: "Telefone", value: "923000001" }, ids, ["Telefone"]), "a");
  assert.equal(matchCustomer({ type: "NIF", value: "5000000001" }, ids, ["Cartão de cliente"]), undefined);
});

test("estatísticas de compra: intervalo habitual, risco e dívida vencida", () => {
  const sales = [
    sale("2026-08-01T10:00", 100),
    sale("2026-08-11T10:00", 100),
    sale("2026-08-21T10:00", 100, { payment: "Crédito", paid: false }),
  ];
  const stats = purchaseStats(sales, company.id, "2026-10-13", 5_000);
  assert.equal(stats.usualInterval, 10);
  assert.equal(stats.daysSincePurchase, 53);
  assert.equal(stats.atRisk, true);
  assert.equal(stats.debt, 100);
  assert.equal(stats.overdueDebt, 100);
  assert.equal(stats.creditLimit, 5_000);
});

test("N dias sem comprar: passos no dia certo, a contar da ativação, sem repetir", () => {
  const sales = [sale("2026-09-01T10:00", 100)];
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "dias-sem-comprar", days: 30 }, activatedAt: "2026-10-05" });
  const first = dueSteps({ automations: [rule], companies: [company], sales, today: "2026-10-06", done: new Set() });
  assert.deepEqual(first.map((item) => [item.step.id, item.dueDate]), [["s1", "2026-10-05"]]);
  const later = dueSteps({ automations: [rule], companies: [company], sales, today: "2026-10-13", done: new Set([first[0].key]) });
  assert.deepEqual(later.map((item) => item.step.id), ["s2"]);
});

test("N dias sem comprar: nova compra termina a sequência", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "dias-sem-comprar", days: 30 } });
  const sales = [sale("2026-09-01T10:00", 100), sale("2026-10-12T10:00", 100)];
  assert.equal(dueSteps({ automations: [rule], companies: [company], sales, today: "2026-10-13", done: new Set() }).length, 0);
});

test("automação pausada ou cliente arquivado não corre", () => {
  const sales = [sale("2026-01-01T10:00", 100)];
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "dias-sem-comprar", days: 30 } });
  assert.equal(dueSteps({ automations: [{ ...rule, status: "Pausada" }], companies: [company], sales, today: "2026-10-13", done: new Set() }).length, 0);
  assert.equal(dueSteps({ automations: [rule], companies: [{ ...company, archived: true }], sales, today: "2026-10-13", done: new Set() }).length, 0);
});

test("dívida vencida conta a partir da compra a crédito mais antiga por pagar", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "divida-vencida", days: 30 } });
  const unpaid = [sale("2026-09-01T10:00", 100, { payment: "Crédito", paid: false })];
  const due = dueSteps({ automations: [rule], companies: [company], sales: unpaid, today: "2026-10-13", done: new Set() });
  assert.equal(due[0].dueDate, "2026-10-01");
  const paid = [sale("2026-09-01T10:00", 100, { payment: "Crédito", paid: true })];
  assert.equal(dueSteps({ automations: [rule], companies: [company], sales: paid, today: "2026-10-13", done: new Set() }).length, 0);
});

test("acontecimentos: cliente criado e fase alterada só depois da ativação", () => {
  const created = automation({ trigger: { ...DEFAULT_TRIGGER, type: "cliente-criado" }, activatedAt: "2026-10-01" });
  const stage = automation({ id: "aut-fase", trigger: { ...DEFAULT_TRIGGER, type: "fase-alterada", stage: "Proposta" } });
  const events = [
    { id: "e1", type: "cliente-criado" as const, companyId: company.id, date: "2026-09-20" },
    { id: "e2", type: "cliente-criado" as const, companyId: company.id, date: "2026-10-13" },
    { id: "e3", type: "fase-alterada" as const, companyId: company.id, date: "2026-10-13", stage: "Negociação" },
  ];
  const due = dueSteps({ automations: [created, stage], companies: [company], sales: [], events, today: "2026-10-13", done: new Set() });
  assert.deepEqual(due.map((item) => item.key), ["aut-teste|cliente-teste|e2|s1"]);
});

test("aniversário usa a data de cliente desde, uma vez por ano", () => {
  const rule = automation({ trigger: { ...DEFAULT_TRIGGER, type: "aniversario" } });
  const withSince = { ...company, profile: { ...EMPTY_PROFILE, customerSince: "2020-10-13" } };
  const due = dueSteps({ automations: [rule], companies: [withSince], sales: [], today: "2026-10-13", done: new Set() });
  assert.equal(due[0].key, "aut-teste|cliente-teste|2026|s1");
  assert.equal(dueSteps({ automations: [rule], companies: [withSince], sales: [], today: "2026-10-12", done: new Set() }).length, 0);
});

test("desconto aproveitado só sobre as categorias da proposta", () => {
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
  const mixed = sale("2026-10-10T10:00", 0, {
    lines: [
      { category: "Bebidas", description: "Sumo", quantity: 2, unitPrice: 1000 },
      { category: "Mercearia", description: "Açúcar", quantity: 1, unitPrice: 5000 },
    ],
    total: 7000,
  });
  assert.equal(offerDiscountValue(offer, mixed), 200);
  assert.equal(offerDiscountValue({ ...offer, scope: "Toda a encomenda", categories: [] }, mixed), 700);
  assert.equal(offerStatus(offer, "2026-10-16"), "Expirada");
});

test("automações de exemplo têm passos válidos", () => {
  for (const item of AUTOMATIONS) assert.ok(item.steps.length > 0, item.name);
});
