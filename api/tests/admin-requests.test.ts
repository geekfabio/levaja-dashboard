import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount, insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const userAccountIds: string[] = [];
const requestIds: string[] = [];

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

const PICKUP = placeFixture("plc-maianga", -8.8256, 13.2311);
const DROPOFF = placeFixture("plc-talatona", -8.9167, 13.1833);

function createRequestBody(clientId: string) {
  return {
    service_type: "tow",
    client_id: clientId,
    pickup: PICKUP,
    dropoff: DROPOFF,
    stops: [],
    scheduled_for: null,
    tow_details: { incident: "mechanical", brand: "Toyota", model: "Corolla", plate: "LD-01-01-AA", color: "Branco", can_move: true },
    cargo_details: null,
    moving_details: null,
    photos: [],
    instructions: null,
    payment_method: "cash",
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (requestIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.requestId, requestIds));
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (userAccountIds.length > 0) {
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, userAccountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, userAccountIds));
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, userAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...userAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

test("lista e lê pedidos como operações", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("admin-req-list");
  userAccountIds.push(client.id);
  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  assert.equal(create.statusCode, 201);
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  const list = await app.inject({ method: "GET", url: "/admin/requests", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === reqId));
  assert.ok(list.json().meta.total >= 1);

  const get = await app.inject({ method: "GET", url: `/admin/requests/${reqId}`, cookies: session.cookies });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.id, reqId);

  const active = await app.inject({ method: "GET", url: "/admin/requests/active", cookies: session.cookies });
  assert.equal(active.statusCode, 200);
  assert.ok(active.json().data.some((item: { id: string }) => item.id === reqId));
});

test("suporte não vê pedidos (forbidden), operações cancela com motivo e fica auditado", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("admin-req-cancel");
  userAccountIds.push(client.id);
  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  const forbiddenCancel = await app.inject({
    method: "POST",
    url: `/admin/requests/${reqId}/cancel`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Suporte a tentar cancelar." },
  });
  assert.equal(forbiddenCancel.statusCode, 403);
  assert.equal(forbiddenCancel.json().error.code, "forbidden");

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/requests/${reqId}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: {},
  });
  assert.equal(noReason.statusCode, 422);
  assert.equal(noReason.json().error.code, "validation");

  const cancel = await app.inject({
    method: "POST",
    url: `/admin/requests/${reqId}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Cliente reportou duplicado." },
  });
  assert.equal(cancel.statusCode, 200);
  assert.equal(cancel.json().data.status, "cancelled");
  assert.equal(cancel.json().data.cancel_reason, "Cliente reportou duplicado.");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [reqId]));
  assert.ok(auditRows.some((row) => row.action === "request.cancel"));

  const alreadyCancelled = await app.inject({
    method: "POST",
    url: `/admin/requests/${reqId}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Outra tentativa." },
  });
  assert.equal(alreadyCancelled.statusCode, 409);
  assert.equal(alreadyCancelled.json().error.code, "invalid_transition");
});

test("cancelar depois de pickup_confirmed é rejeitado (invalid_transition)", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("admin-req-late-cancel");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("admin-req-late-cancel");
  userAccountIds.push(provider.id);

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  await app.inject({ method: "POST", url: `/requests/${reqId}/accept`, headers: auth(provider.token), payload: { provider_id: provider.id } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(provider.token), payload: { to: "en_route", actor: "provider" } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(provider.token), payload: { to: "arrived", actor: "provider" } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(client.token), payload: { to: "pickup_confirmed", actor: "client" } });

  const cancel = await app.inject({
    method: "POST",
    url: `/admin/requests/${reqId}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Já não é possível." },
  });
  assert.equal(cancel.statusCode, 409);
  assert.equal(cancel.json().error.code, "invalid_transition");
});
