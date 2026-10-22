import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPANIES } from "@/data/companies";
import { COMPANY_PROFILES } from "@/data/company-profiles";
import { analyzeRows, guessMapping, parseCsv } from "@/lib/import";

const companies = COMPANIES.map((company) => ({ ...company, profile: COMPANY_PROFILES[company.id] }));
const context = { companies, zones: ["Luanda", "Benguela", "Huíla"], owners: ["Sara Neto", "Jaime Teixeira"], today: "2026-10-13" };

test("CSV com ponto e vírgula, aspas, BOM e quebras de linha", () => {
  const rows = parseCsv('﻿Nome;Morada\r\n"Mercearia ""A""";"Rua 1;\nLuanda"\r\n\r\nLoja B;Rua 2\n');
  assert.deepEqual(rows, [
    ["Nome", "Morada"],
    ['Mercearia "A"', "Rua 1;\nLuanda"],
    ["Loja B", "Rua 2"],
  ]);
});

test("CSV com vírgula como separador", () => {
  assert.deepEqual(parseCsv("Nome,NIF\nLoja,5000000001"), [["Nome", "NIF"], ["Loja", "5000000001"]]);
});

test("mapeamento automático das colunas pelo cabeçalho, sem acentos", () => {
  const mapping = guessMapping(["Nome", "NIF", "Município", "Limite de crédito", "Telefone do contacto"]);
  assert.equal(mapping.name, 0);
  assert.equal(mapping.nif, 1);
  assert.equal(mapping.municipality, 2);
  assert.equal(mapping.creditLimit, 3);
  assert.equal(mapping.contactPhone, 4);
});

test("linhas: criar, atualizar por NIF existente, erro e repetida no ficheiro", () => {
  const existingNif = COMPANY_PROFILES[COMPANIES[0].id].nif;
  const rows = [
    ["Loja Nova", "5000111222", "Luanda", "1.500.000"],
    ["Outro Nome", existingNif, "Luanda", ""],
    ["Errada", "123", "Moxico", "abc"],
    ["Loja Nova Bis", "5000111222", "Luanda", ""],
  ];
  const result = analyzeRows(rows, { name: 0, nif: 1, zone: 2, creditLimit: 3 }, context);
  assert.equal(result[0].action, "criar");
  assert.equal(result[0].profile.creditLimit, 1_500_000);
  assert.equal(result[1].action, "atualizar");
  assert.equal(result[1].matchId, COMPANIES[0].id);
  assert.equal(result[2].action, "ignorar");
  assert.ok(result[2].errors.some((error) => error.includes("NIF inválido")));
  assert.ok(result[2].warnings.some((warning) => warning.includes("Moxico")));
  assert.equal(result[3].action, "ignorar");
  assert.ok(result[3].warnings[0].includes("linha 2"));
});

test("nome igual a um cliente existente não cria duplicado sem confirmação", () => {
  const [row] = analyzeRows([[COMPANIES[1].name.toUpperCase()]], { name: 0 }, context);
  assert.equal(row.action, "ignorar");
  assert.equal(row.matchId, COMPANIES[1].id);
});
