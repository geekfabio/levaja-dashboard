import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocumentLine } from "@/data/quotes";
import { documentTotals, lineNet, nextNumber, quoteStatus } from "@/lib/quotes";
import { QUOTES } from "@/data/quotes";

const line = (quantity: number, unitPrice: number, discount = 0): DocumentLine => ({
  id: "l",
  productId: "X",
  name: "Produto",
  unit: "caixa",
  category: "Mercearia",
  quantity,
  unitPrice,
  discount,
});

test("linha aplica desconto de tabela e depois o da linha", () => {
  assert.equal(lineNet(line(10, 1000), 0), 10_000);
  assert.equal(lineNet(line(10, 1000), 10), 9_000);
  assert.equal(lineNet(line(10, 1000, 10), 10), 8_100);
});

test("totais com IVA de 14%", () => {
  const totals = documentTotals([line(10, 1000), line(1, 5000, 20)], 0);
  assert.equal(totals.gross, 15_000);
  assert.equal(totals.net, 14_000);
  assert.equal(totals.discount, 1_000);
  assert.equal(totals.vat, 1_960);
  assert.equal(totals.total, 15_960);
});

test("numeração sequencial por ano", () => {
  assert.equal(nextNumber("COT", ["COT 2026/0041", "COT 2026/0007", "COT 2025/0099"], "2026"), "COT 2026/0042");
  assert.equal(nextNumber("ENC", [], "2027"), "ENC 2027/0001");
});

test("cotação enviada fora da validade aparece como expirada", () => {
  const sent = { ...QUOTES[0], status: "Enviada" as const, validUntil: "2026-10-10" };
  assert.equal(quoteStatus(sent, "2026-10-13"), "Expirada");
  assert.equal(quoteStatus({ ...sent, status: "Aceite" }, "2026-10-13"), "Aceite");
});
