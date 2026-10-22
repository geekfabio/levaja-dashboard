import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidNif, normalizeNif } from "@/lib/nif";
import { formatAngolanPhone, normalizeAngolanPhone, operatorFor } from "@/lib/phone";
import { analyzeSms } from "@/lib/sms";
import { isOptOut } from "@/lib/conversations";
import { distanceMeters } from "@/lib/geo";

test("NIF: empresa com 10 dígitos e pessoa singular com BI", () => {
  assert.equal(isValidNif("5417200000"), true);
  assert.equal(isValidNif("004512345LA042"), true);
  assert.equal(isValidNif("541 720 0000"), true);
  assert.equal(isValidNif("12345"), false);
  assert.equal(isValidNif("ABCDEFGHIJ"), false);
  assert.equal(normalizeNif("004.512.345-la042"), "004512345LA042");
});

test("telefone angolano normalizado para E.164 e operadora", () => {
  assert.equal(normalizeAngolanPhone("923 111 222"), "+244923111222");
  assert.equal(normalizeAngolanPhone("+244 923 111 222"), "+244923111222");
  assert.equal(normalizeAngolanPhone("00244923111222"), "+244923111222");
  assert.equal(normalizeAngolanPhone("111"), null);
  assert.equal(formatAngolanPhone("+244923111222"), "+244 923 111 222");
  assert.equal(operatorFor("+244923111222"), "Unitel");
  assert.equal(operatorFor("+244953111222"), "Africell");
});

test("SMS: acentos contam 2 unidades e 120 unidades por mensagem", () => {
  assert.equal(analyzeSms("a".repeat(120)).messages, 1);
  assert.equal(analyzeSms("a".repeat(121)).messages, 2);
  assert.equal(analyzeSms("ação").units, 6);
  assert.deepEqual(analyzeSms("ação").doubleChars.sort(), ["ã", "ç"]);
  assert.equal(analyzeSms("").messages, 0);
});

test("resposta PARAR retira consentimento, com ou sem acentos e pontuação", () => {
  assert.equal(isOptOut("PARAR"), true);
  assert.equal(isOptOut(" parar. "), true);
  assert.equal(isOptOut("Stop"), true);
  assert.equal(isOptOut("Não quero parar de receber"), false);
});

test("distância entre dois pontos em metros", () => {
  assert.equal(distanceMeters({ lat: -8.8236, lng: 13.2311 }, { lat: -8.8236, lng: 13.2311 }), 0);
  const viana = distanceMeters({ lat: -8.8236, lng: 13.2311 }, { lat: -8.9035, lng: 13.3741 });
  assert.ok(viana > 17_000 && viana < 19_000);
});
