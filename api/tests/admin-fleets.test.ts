import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount, insertProviderAccount, testEmail } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const providerAccountIds: string[] = [];
const fleetIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (providerAccountIds.length > 0) {
    await db.update(schema.providers).set({ fleetId: null }).where(inArray(schema.providers.accountId, providerAccountIds));
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, providerAccountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, providerAccountIds));
  }
  if (fleetIds.length > 0) {
    await db.delete(schema.fleets).where(inArray(schema.fleets.id, fleetIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

function randomNif() {
  return String(Math.floor(100000000 + Math.random() * 899999999));
}

test("cria frota, acrescenta e remove motorista, consulta detalhe com estatísticas", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const session = await createAdminSession(app, opsAdmin.id);

  const invalid = await app.inject({
    method: "POST",
    url: "/admin/fleets",
    cookies: session.cookies,
    headers: session.headers,
    payload: { name: "", nif: "123", contact_name: "A", phone: "900", email: "not-an-email" },
  });
  assert.equal(invalid.statusCode, 422);
  assert.equal(invalid.json().error.code, "validation");

  const nif = randomNif();
  const create = await app.inject({
    method: "POST",
    url: "/admin/fleets",
    cookies: session.cookies,
    headers: session.headers,
    payload: { name: "Transportes Kianda", nif, contact_name: "Manuel dos Santos", phone: "+244 923 456 789", email: testEmail("fleet") },
  });
  assert.equal(create.statusCode, 200);
  const fleet = create.json().data;
  fleetIds.push(fleet.id);
  assert.equal(fleet.status, "active");
  assert.equal(fleet.stats.drivers, 0);

  const duplicateNif = await app.inject({
    method: "POST",
    url: "/admin/fleets",
    cookies: session.cookies,
    headers: session.headers,
    payload: { name: "Outra Frota", nif, contact_name: "Outro", phone: "+244 923 456 780", email: testEmail("fleet-dup") },
  });
  assert.equal(duplicateNif.statusCode, 422);

  const driver = await insertProviderAccount("fleet-driver");
  providerAccountIds.push(driver.id);

  const add = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/drivers`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { provider_id: driver.id },
  });
  assert.equal(add.statusCode, 200);
  assert.equal(add.json().data.drivers.length, 1);
  assert.equal(add.json().data.stats.drivers, 1);

  const duplicateAdd = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/drivers`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { provider_id: driver.id },
  });
  assert.equal(duplicateAdd.statusCode, 422);
  assert.equal(duplicateAdd.json().error.code, "validation");

  const detail = await app.inject({ method: "GET", url: `/admin/fleets/${fleet.id}`, cookies: session.cookies });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.drivers[0].id, driver.id);

  const removeMissingReason = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/drivers/${driver.id}/remove`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(removeMissingReason.statusCode, 422);

  const remove = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/drivers/${driver.id}/remove`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Motorista saiu da frota." },
  });
  assert.equal(remove.statusCode, 200);
  assert.equal(remove.json().data.drivers.length, 0);

  const list = await app.inject({ method: "GET", url: "/admin/fleets?q=Kianda", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === fleet.id));

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [fleet.id]));
  assert.deepEqual(
    auditRows.map((row) => row.action).sort(),
    ["fleet.create", "fleet.driver_add", "fleet.driver_remove"],
  );
});

test("finanças não gere frotas (forbidden); suspender exige motivo e bloqueia novos motoristas", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const create = await app.inject({
    method: "POST",
    url: "/admin/fleets",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { name: "Frota Suspensa", nif: randomNif(), contact_name: "Responsável", phone: "+244 912 000 111", email: testEmail("fleet-suspend") },
  });
  assert.equal(create.statusCode, 200);
  const fleet = create.json().data;
  fleetIds.push(fleet.id);

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/status`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { status: "suspended", reason: "Teste" },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const missingReason = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/status`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { status: "suspended" },
  });
  assert.equal(missingReason.statusCode, 422);

  const suspend = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/status`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { status: "suspended", reason: "Documentação da frota expirada." },
  });
  assert.equal(suspend.statusCode, 200);
  assert.equal(suspend.json().data.status, "suspended");

  const sameStatus = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/status`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { status: "suspended", reason: "Repetir." },
  });
  assert.equal(sameStatus.statusCode, 409);
  assert.equal(sameStatus.json().error.code, "invalid_transition");

  const driver = await insertProviderAccount("fleet-driver-suspended");
  providerAccountIds.push(driver.id);
  const addToSuspended = await app.inject({
    method: "POST",
    url: `/admin/fleets/${fleet.id}/drivers`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { provider_id: driver.id },
  });
  assert.equal(addToSuspended.statusCode, 409);
  assert.equal(addToSuspended.json().error.code, "invalid_transition");
});
