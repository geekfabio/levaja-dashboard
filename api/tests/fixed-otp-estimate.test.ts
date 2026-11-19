import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { loadEnv } from "../src/env";
import { newOtpCode } from "../src/lib/tokens";
import { generateOtpCode } from "../src/lib/otp-admin";
import { insertAdminAccount, insertClientAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;
const adminIds: string[] = [];
const clientIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  delete process.env.OTP_FIXED_CODE;
  const emails = await db.select({ email: schema.accounts.email }).from(schema.accounts).where(inArray(schema.accounts.id, adminIds));
  if (emails.length > 0) await db.delete(schema.otpCodes).where(inArray(schema.otpCodes.email, emails.map((row) => row.email)));
  if (adminIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminIds));
    await db.delete(schema.adminAccessLog).where(inArray(schema.adminAccessLog.accountId, adminIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminIds));
  }
  if (clientIds.length > 0) await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientIds));
  const all = [...adminIds, ...clientIds];
  if (all.length > 0) await db.delete(schema.accounts).where(inArray(schema.accounts.id, all));
  await app.close();
});

test("sem OTP_FIXED_CODE os códigos são aleatórios de 6 dígitos", () => {
  delete process.env.OTP_FIXED_CODE;
  const codes = new Set(Array.from({ length: 20 }, () => newOtpCode()));
  assert.ok(codes.size > 1);
  for (const code of codes) assert.match(code, /^\d{6}$/);
});

test("com OTP_FIXED_CODE, app e painel recebem sempre esse código", () => {
  process.env.OTP_FIXED_CODE = "123456";
  assert.equal(newOtpCode(), "123456");
  assert.equal(generateOtpCode(), "123456");
  delete process.env.OTP_FIXED_CODE;
});

test("a configuração recusa um OTP_FIXED_CODE inválido", () => {
  const base = { ...process.env };
  assert.equal(loadEnv({ ...base, OTP_FIXED_CODE: "123456" }).OTP_FIXED_CODE, "123456");
  assert.equal(loadEnv({ ...base, OTP_FIXED_CODE: "" }).OTP_FIXED_CODE, undefined);
  assert.throws(() => loadEnv({ ...base, OTP_FIXED_CODE: "12345" }));
  assert.throws(() => loadEnv({ ...base, OTP_FIXED_CODE: "abcdef" }));
  assert.throws(() => loadEnv({ ...base, OTP_FIXED_CODE: "000000" }));
});

test("login do painel com o código fixo; um código errado continua recusado", async () => {
  process.env.OTP_FIXED_CODE = "123456";
  const admin = await insertAdminAccount("admin", "fixed-otp");
  adminIds.push(admin.id);

  const requested = await app.inject({ method: "POST", url: "/admin/auth/request-code", payload: { email: admin.email } });
  assert.equal(requested.statusCode, 200);

  const wrong = await app.inject({ method: "POST", url: "/admin/auth/login", payload: { email: admin.email, code: "654321" } });
  assert.equal(wrong.statusCode, 401);

  const ok = await app.inject({ method: "POST", url: "/admin/auth/login", payload: { email: admin.email, code: "123456" } });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.cookies.some((cookie) => cookie.name === "admin_session"));
  delete process.env.OTP_FIXED_CODE;
});

test("POST /pricing/estimate devolve o mesmo preço que o pedido vai ter; exige cliente", async () => {
  const client = await insertClientAccount("estimate");
  clientIds.push(client.id);
  const payload = {
    service_type: "tow",
    pickup: placeFixture("plc-est-a", -8.8256, 13.2311),
    dropoff: placeFixture("plc-est-b", -8.9167, 13.1833),
    stops: [],
    tow_details: null,
    cargo_details: null,
    moving_details: null,
  };
  const headers = { authorization: `Bearer ${client.token}` };

  const anonymous = await app.inject({ method: "POST", url: "/pricing/estimate", payload });
  assert.equal(anonymous.statusCode, 401);

  const estimate = await app.inject({ method: "POST", url: "/pricing/estimate", headers, payload });
  assert.equal(estimate.statusCode, 200);
  const data = estimate.json().data;
  assert.ok(data.distance_km > 0);
  assert.ok(data.duration_min >= 8);
  assert.equal(data.pricing.total_kz, data.pricing.base_kz + data.pricing.distance_kz + data.pricing.extras_kz + data.pricing.platform_fee_kz);

  const created = await app.inject({
    method: "POST",
    url: "/requests",
    headers,
    payload: { ...payload, client_id: client.id, scheduled_for: null, photos: [], instructions: null, payment_method: null },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().data.pricing.total_kz, data.pricing.total_kz);
  await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, [created.json().data.id]));
  await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, [created.json().data.id]));
});

test("o seed é idempotente: segunda execução não cria zonas nem administradores", async () => {
  const count = async () => ({
    zones: (await db.select().from(schema.zones)).length,
    admins: (await db.select().from(schema.accounts)).filter((row) => row.kind === "admin" && row.email === "trindadecode@gmail.com").length,
  });
  const { execFileSync } = await import("node:child_process");
  const run = () => execFileSync("npx", ["tsx", "src/db/seed.ts"], { cwd: process.cwd(), encoding: "utf8" });
  run();
  const first = await count();
  run();
  assert.deepEqual(await count(), first);
  assert.equal(first.admins, 1);
});
