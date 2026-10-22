import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMISSION_TIERS } from "@/data/commissions";
import { COMPANIES } from "@/data/companies";
import type { Contact } from "@/data/contacts";
import type { Sale } from "@/data/sales";
import { monthProgress, rateFor, sellerResults, shiftMonth } from "@/lib/commissions";
import { buildIcs } from "@/lib/ics";
import { retentionCandidates } from "@/lib/privacy";

test("escalões de comissão pelo cumprimento do objetivo", () => {
  assert.equal(rateFor(50, COMMISSION_TIERS), 1);
  assert.equal(rateFor(80, COMMISSION_TIERS), 1.5);
  assert.equal(rateFor(130, COMMISSION_TIERS), 2);
});

test("comissão só sobre vendas recebidas; crédito por pagar fica pendente", () => {
  const owner = COMPANIES[0].owner;
  const base = { channel: "Loja Viana" as const, lines: [], source: "Simulação" as const, document: "FR" };
  const sales: Sale[] = [
    { ...base, id: "1", at: "2026-10-02T10:00", payment: "Numerário", companyId: COMPANIES[0].id, total: 900_000, paid: true },
    { ...base, id: "2", at: "2026-10-03T10:00", payment: "Crédito", companyId: COMPANIES[0].id, total: 100_000, paid: false },
    { ...base, id: "3", at: "2026-09-03T10:00", payment: "Numerário", companyId: COMPANIES[0].id, total: 5_000_000, paid: true },
  ];
  const [result] = sellerResults(sales, [COMPANIES[0]], "2026-10", "2026-10-31", () => 1_000_000, COMMISSION_TIERS).filter((item) => item.owner === owner);
  assert.equal(result.sold, 1_000_000);
  assert.equal(result.achievement, 100);
  assert.equal(result.rate, 2);
  assert.equal(result.commission, 18_000);
  assert.equal(result.pending, 2_000);
});

test("meses e progresso do mês", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(monthProgress("2026-10", "2026-11-02"), 1);
  assert.ok(Math.abs(monthProgress("2026-10", "2026-10-31") - 1) < 1e-9);
});

test("calendário .ics: eventos de dia inteiro, texto escapado e linhas dobradas", () => {
  const ics = buildIcs(
    [{ uid: "a", date: "2026-10-13", title: "Visita: Loja, Lda; urgente", description: "Linha 1\nLinha 2".repeat(10) }],
    "Follow-up",
    "20261013T090000",
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261013"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20261014"));
  assert.ok(ics.includes("SUMMARY:Visita: Loja\\, Lda\; urgente"));
  assert.ok(ics.split("\r\n").every((line) => line.length <= 75));
});

test("retenção: pediu remoção, saiu da empresa ou cliente inativo além do prazo", () => {
  const contact = (id: string, contactability: Contact["contactability"], companyId: string): Contact => ({
    id,
    name: id,
    role: "",
    companyId,
    companyName: "",
    phone: "",
    whatsapp: "",
    email: "",
    preferredLanguage: "Português",
    contactability,
    consent: {
      email: { granted: false, date: "", origin: "" },
      sms: { granted: false, date: "", origin: "" },
      whatsapp: { granted: false, date: "", origin: "" },
    },
  });
  const days: Record<string, number> = { ativo: 10, inativo: 900 };
  const result = retentionCandidates(
    [contact("a", "Pediu remoção", "ativo"), contact("b", "Válido", "ativo"), contact("c", "Válido", "inativo"), contact("d", "Saiu da empresa", "ativo")],
    (companyId) => days[companyId],
    24,
  );
  assert.deepEqual(result.map((item) => item.contact.id), ["a", "c", "d"]);
});
