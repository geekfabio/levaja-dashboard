import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const userAccountIds: string[] = [];
const requestIds: string[] = [];
const refundIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (refundIds.length > 0) {
    await db.delete(schema.refunds).where(inArray(schema.refunds.id, refundIds));
  }
  if (requestIds.length > 0) {
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

async function createPaidRequest(clientId: string, providerId: string | null, totalKz = 10000) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "tow",
    status: "paid",
    clientAccountId: clientId,
    providerAccountId: providerId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    dropoff: placeFixture("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [],
    pickupPhotos: [],
    pricing: { base_kz: 8000, distance_kz: 1500, extras_kz: 0, platform_fee_kz: 500, total_kz: totalKz },
    paymentMethod: "cash",
  });
  requestIds.push(id);
  return { id, code };
}

test("lista reembolsos, cria, exige dupla aprovação acima do limite e paga", async () => {
  const financeAdmin1 = await insertAdminAccount("finance", "finance-a");
  adminAccountIds.push(financeAdmin1.id);
  const financeSession1 = await createAdminSession(app, financeAdmin1.id);

  const financeAdmin2 = await insertAdminAccount("finance", "finance-b");
  adminAccountIds.push(financeAdmin2.id);
  const financeSession2 = await createAdminSession(app, financeAdmin2.id);

  const client = await insertClientAccount("refund-flow");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("refund-flow");
  userAccountIds.push(provider.id);
  const { id: requestId, code } = await createPaidRequest(client.id, provider.id, 30000);

  const create = await app.inject({
    method: "POST",
    url: "/admin/refunds",
    cookies: financeSession1.cookies,
    headers: financeSession1.headers,
    payload: { request_id: requestId, amount_kz: 25000, reason: "Cliente reportou atraso excessivo.", charge_provider: false },
  });
  assert.equal(create.statusCode, 200);
  const refund = create.json().data;
  refundIds.push(refund.id);
  assert.equal(refund.status, "pending");
  assert.equal(refund.request_code, code);

  const list = await app.inject({ method: "GET", url: "/admin/refunds", cookies: financeSession1.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === refund.id));

  const forRequest = await app.inject({ method: "GET", url: `/admin/requests/${requestId}/refunds`, cookies: financeSession1.cookies });
  assert.equal(forRequest.statusCode, 200);
  assert.equal(forRequest.json().data.refundable_kz, 5000);

  // Regra de negócio: reembolsos acima do limite de dupla aprovação não
  // podem ser aprovados por quem os pediu, mesmo tendo a permissão.
  const selfApprove = await app.inject({
    method: "POST",
    url: `/admin/refunds/${refund.id}/approve`,
    cookies: financeSession1.cookies,
    headers: financeSession1.headers,
    payload: {},
  });
  assert.equal(selfApprove.statusCode, 403);
  assert.equal(selfApprove.json().error.code, "forbidden");

  const approve = await app.inject({
    method: "POST",
    url: `/admin/refunds/${refund.id}/approve`,
    cookies: financeSession2.cookies,
    headers: financeSession2.headers,
    payload: {},
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().data.status, "approved");

  const noReference = await app.inject({
    method: "POST",
    url: `/admin/refunds/${refund.id}/mark-paid`,
    cookies: financeSession2.cookies,
    headers: financeSession2.headers,
    payload: { payment_reference: "" },
  });
  assert.equal(noReference.statusCode, 422);

  const markPaid = await app.inject({
    method: "POST",
    url: `/admin/refunds/${refund.id}/mark-paid`,
    cookies: financeSession2.cookies,
    headers: financeSession2.headers,
    payload: { payment_reference: "REF-0001" },
  });
  assert.equal(markPaid.statusCode, 200);
  assert.equal(markPaid.json().data.status, "paid");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [refund.id]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["refund.approve", "refund.paid", "refund.request"]);
});

test("suporte não decide reembolsos (forbidden); valor acima do disponível é rejeitado (validation)", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("refund-over");
  userAccountIds.push(client.id);
  const { id: requestId } = await createPaidRequest(client.id, null, 10000);

  const over = await app.inject({
    method: "POST",
    url: "/admin/refunds",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { request_id: requestId, amount_kz: 50000, reason: "Valor exagerado de teste." },
  });
  assert.equal(over.statusCode, 422);
  assert.equal(over.json().error.code, "validation");

  const create = await app.inject({
    method: "POST",
    url: "/admin/refunds",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { request_id: requestId, amount_kz: 5000, reason: "Reembolso parcial de teste." },
  });
  assert.equal(create.statusCode, 200);
  refundIds.push(create.json().data.id);

  const decide = await app.inject({
    method: "POST",
    url: `/admin/refunds/${create.json().data.id}/approve`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: {},
  });
  assert.equal(decide.statusCode, 403);
  assert.equal(decide.json().error.code, "forbidden");
});
