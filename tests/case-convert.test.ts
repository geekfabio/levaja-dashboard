import { test } from "node:test";
import assert from "node:assert/strict";
import { deepCamelToSnake, deepSnakeToCamel } from "@/lib/case-convert";

test("deepCamelToSnake: converte chaves aninhadas e listas", () => {
  assert.deepEqual(
    deepCamelToSnake({ clientAccountId: "c1", pickup: { lat: 1, lng: 2 }, items: [{ requestId: "r1" }] }),
    { client_account_id: "c1", pickup: { lat: 1, lng: 2 }, items: [{ request_id: "r1" }] },
  );
});

test("deepSnakeToCamel: converte chaves aninhadas e listas", () => {
  assert.deepEqual(
    deepSnakeToCamel({ client_account_id: "c1", pickup: { lat: 1, lng: 2 }, items: [{ request_id: "r1" }] }),
    { clientAccountId: "c1", pickup: { lat: 1, lng: 2 }, items: [{ requestId: "r1" }] },
  );
});

test("case convert: preserva primitivos, null e datas", () => {
  assert.equal(deepSnakeToCamel("abc"), "abc");
  assert.equal(deepSnakeToCamel(null), null);
  assert.equal(deepSnakeToCamel(42), 42);
  const date = new Date();
  assert.equal(deepSnakeToCamel(date), date);
});
