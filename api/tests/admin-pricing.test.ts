import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, "pricing"));
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

const BASE_RULES = [
  { kind: "tow", base: 8000, per_km: 250 },
  { kind: "cargo", base: 5500, per_km: 250 },
  { kind: "small_move", base: 9000, per_km: 300 },
  { kind: "house_move", base: 18000, per_km: 400 },
];

test("lê a tabela de preços por omissão", async () => {
  const admin = await insertAdminAccount("finance");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const get = await app.inject({ method: "GET", url: "/admin/pricing", cookies: session.cookies });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.platform_fee, 500);
});

test("finanças não pode editar preços (forbidden); administrador actualiza com motivo e fica auditado", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const payload = { rules: BASE_RULES, extras: [], platform_fee: 600, commission_rate: 0.15, round_to: 500, reason: "Ajuste de taxa." };

  const forbidden = await app.inject({
    method: "PUT",
    url: "/admin/pricing",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload,
  });
  assert.equal(forbidden.statusCode, 403);

  const noReason = await app.inject({
    method: "PUT",
    url: "/admin/pricing",
    cookies: session.cookies,
    headers: session.headers,
    payload: { ...payload, reason: undefined },
  });
  assert.equal(noReason.statusCode, 422);

  const duplicateKind = await app.inject({
    method: "PUT",
    url: "/admin/pricing",
    cookies: session.cookies,
    headers: session.headers,
    payload: { ...payload, rules: [...BASE_RULES, { kind: "tow", base: 1, per_km: 1 }] },
  });
  assert.equal(duplicateKind.statusCode, 422);

  const update = await app.inject({
    method: "PUT",
    url: "/admin/pricing",
    cookies: session.cookies,
    headers: session.headers,
    payload,
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.platform_fee, 600);

  const noChanges = await app.inject({
    method: "PUT",
    url: "/admin/pricing",
    cookies: session.cookies,
    headers: session.headers,
    payload,
  });
  assert.equal(noChanges.statusCode, 422);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, [admin.id]));
  assert.ok(auditRows.some((row) => row.action === "pricing.update"));
});
