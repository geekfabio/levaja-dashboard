import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const providerAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const requestIds: string[] = [];
const cashDepositIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (cashDepositIds.length > 0) {
    await db.delete(schema.cashDeposits).where(inArray(schema.cashDeposits.id, cashDepositIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  }
  if (clientAccountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...providerAccountIds, ...clientAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function insertCashSettledRequest(providerId: string, clientAccountId: string, totalKz: number, platformFeeKz: number, providerEarningKz: number) {
  const id = newId("req");
  const place = placeFixture("plc-cash-balance", -8.83, 13.24);
  const now = new Date();
  await db.insert(schema.serviceRequests).values({
    id,
    code: `LJ-${id.slice(-6).toUpperCase()}`,
    serviceType: "tow",
    status: "paid",
    clientAccountId,
    providerAccountId: providerId,
    pickup: place,
    dropoff: place,
    paymentMethod: "cash",
    pricing: { base_kz: totalKz - platformFeeKz, distance_kz: 0, extras_kz: 0, platform_fee_kz: platformFeeKz, total_kz: totalKz },
    providerEarningKz,
    createdAt: now,
    updatedAt: now,
  });
  requestIds.push(id);
  return id;
}

async function depositCash(financeSession: Awaited<ReturnType<typeof createAdminSession>>, providerId: string, amountKz: number) {
  const res = await app.inject({
    method: "POST",
    url: "/admin/billing/cash-deposits",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: providerId, amount_kz: amountKz, reference: "teste" },
  });
  if (res.statusCode === 200) cashDepositIds.push(res.json().data.id);
  return res;
}

test("GET /providers/:id/balance reflecte o que o prestador deve por corridas em numerário", async () => {
  const client = await insertClientAccount("cash-balance-view");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("cash-balance-view");
  providerAccountIds.push(provider.id);

  await insertCashSettledRequest(provider.id, client.id, 9000, 500, 7200);

  const res = await app.inject({ method: "GET", url: `/providers/${provider.id}/balance`, headers: auth(provider.token) });
  assert.equal(res.statusCode, 200);
  const body = res.json().data;
  assert.equal(body.owed_kz, 1800);
  assert.equal(body.deposited_kz, 0);
  assert.equal(body.balance_kz, -1800);
  assert.equal(body.blocked, true);
});

test("prestador com saldo negativo não consegue ficar disponível; um admin deposita e ele volta a poder", async () => {
  const financeAdmin = await insertAdminAccount("finance", "cash-balance-unblock");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const client = await insertClientAccount("cash-balance-unblock");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("cash-balance-unblock", { online: false });
  providerAccountIds.push(provider.id);

  await insertCashSettledRequest(provider.id, client.id, 9000, 500, 7200);

  const blocked = await app.inject({
    method: "PUT",
    url: `/providers/${provider.id}/availability`,
    headers: auth(provider.token),
    payload: { online: true },
  });
  assert.equal(blocked.statusCode, 422);
  assert.match(blocked.json().error.message, /saldo/i);

  const deposit = await depositCash(financeSession, provider.id, 1800);
  assert.equal(deposit.statusCode, 200);

  const allowed = await app.inject({
    method: "PUT",
    url: `/providers/${provider.id}/availability`,
    headers: auth(provider.token),
    payload: { online: true },
  });
  assert.equal(allowed.statusCode, 204);
});

test("uma corrida em numerário que deixe o saldo negativo tira o prestador de disponível automaticamente", async () => {
  const client = await insertClientAccount("cash-balance-autopause");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("cash-balance-autopause", { online: true });
  providerAccountIds.push(provider.id);

  const requestId = newId("req");
  const place = placeFixture("plc-cash-autopause", -8.83, 13.24);
  await db.insert(schema.serviceRequests).values({
    id: requestId,
    code: `LJ-${requestId.slice(-6).toUpperCase()}`,
    serviceType: "tow",
    status: "delivered",
    clientAccountId: client.id,
    providerAccountId: provider.id,
    pickup: place,
    dropoff: place,
    paymentMethod: "cash",
    pricing: { base_kz: 8500, distance_kz: 0, extras_kz: 0, platform_fee_kz: 500, total_kz: 9000 },
    providerEarningKz: 7200,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  requestIds.push(requestId);

  const pay = await app.inject({ method: "POST", url: `/requests/${requestId}/payments`, headers: auth(client.token), payload: { payment_method: "cash" } });
  assert.equal(pay.statusCode, 201);

  const state = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  assert.equal(state.statusCode, 200);
  assert.equal(state.json().data.online, false);
});

test("com saldo negativo, aceitar um pedido novo (directo, negociação ou proposta) é recusado", async () => {
  const client = await insertClientAccount("cash-balance-accept");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("cash-balance-accept", { online: true });
  providerAccountIds.push(provider.id);

  await insertCashSettledRequest(provider.id, client.id, 9000, 500, 7200);

  const requestId = newId("req");
  const place = placeFixture("plc-cash-accept", -8.83, 13.24);
  await db.insert(schema.serviceRequests).values({
    id: requestId,
    code: `LJ-${requestId.slice(-6).toUpperCase()}`,
    serviceType: "tow",
    status: "searching",
    clientAccountId: client.id,
    providerAccountId: null,
    pickup: place,
    dropoff: place,
    pricing: { base_kz: 8500, distance_kz: 0, extras_kz: 0, platform_fee_kz: 500, total_kz: 9000 },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  requestIds.push(requestId);

  // online continua true na BD (só o PUT /availability bloqueia pôr-se online); o aceite tem de verificar o saldo de qualquer forma.
  const accept = await app.inject({
    method: "POST",
    url: `/requests/${requestId}/accept`,
    headers: auth(provider.token),
    payload: { provider_id: provider.id },
  });
  assert.equal(accept.statusCode, 403);
  assert.match(accept.json().error.message, /saldo/i);
});
