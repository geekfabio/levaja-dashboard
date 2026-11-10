import { test } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { buildApp } from "../src/app";

test("GET /health confirma a ligação à base de dados", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, "ok");
  await app.close();
});

test("rota inexistente devolve o envelope de erro not_found", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/nao-existe" });
  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.error.code, "not_found");
  await app.close();
});
