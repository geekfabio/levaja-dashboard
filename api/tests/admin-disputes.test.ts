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
const disputeIds: string[] = [];
const refundIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (disputeIds.length > 0) {
    await db.delete(schema.disputes).where(inArray(schema.disputes.id, disputeIds));
  }
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

async function openDispute(requestId: string, overrides: Partial<{ openedAt: Date; category: string }> = {}) {
  const id = newId("dp");
  await db.insert(schema.disputes).values({
    id,
    requestId,
    reason: "Cliente reportou dano na carga.",
    category: (overrides.category as "damage" | undefined) ?? "damage",
    openedAt: overrides.openedAt ?? new Date(),
  });
  disputeIds.push(id);
  return id;
}

test("lista disputas, adiciona nota, muda categoria e resolve sem reembolso", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("dispute-flow");
  userAccountIds.push(client.id);
  const { id: requestId, code } = await createPaidRequest(client.id, null, 8000);
  await openDispute(requestId);

  const list = await app.inject({ method: "GET", url: "/admin/disputes?state=open", cookies: opsSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { request: { id: string } }) => item.request.id === requestId));

  const summary = await app.inject({ method: "GET", url: "/admin/disputes/summary", cookies: opsSession.cookies });
  assert.equal(summary.statusCode, 200);
  assert.ok(summary.json().data.open >= 1);

  const note = await app.inject({
    method: "POST",
    url: `/admin/disputes/${requestId}/notes`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { text: "A contactar o prestador." },
  });
  assert.equal(note.statusCode, 200);
  assert.equal(note.json().data.dispute.notes.length, 1);

  const category = await app.inject({
    method: "PATCH",
    url: `/admin/disputes/${requestId}/category`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { category: "conduct" },
  });
  assert.equal(category.statusCode, 200);
  assert.equal(category.json().data.dispute.category, "conduct");

  const resolve = await app.inject({
    method: "POST",
    url: `/admin/disputes/${requestId}/resolve`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { outcome: "no_refund", resolution: "Prestador agiu correctamente, sem indemnização." },
  });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.json().data.request.code, code);
  assert.equal(resolve.json().data.dispute.outcome, "no_refund");
  assert.ok(resolve.json().data.dispute.resolved_at);

  const reopenAttempt = await app.inject({
    method: "POST",
    url: `/admin/disputes/${requestId}/notes`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { text: "Tentativa depois de resolvida." },
  });
  assert.equal(reopenAttempt.statusCode, 409);
  assert.equal(reopenAttempt.json().error.code, "invalid_transition");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [requestId]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["dispute.note", "dispute.note", "dispute.resolve"]);
});

test("finanças não vê disputas (forbidden); resolver com reembolso total cria o reembolso ligado", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const opsAdmin = await insertAdminAccount("operations", "dispute-ops");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("dispute-refund");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("dispute-refund");
  userAccountIds.push(provider.id);
  const { id: requestId } = await createPaidRequest(client.id, provider.id, 12000);
  await openDispute(requestId);

  const forbiddenList = await app.inject({ method: "GET", url: "/admin/disputes", cookies: financeSession.cookies });
  assert.equal(forbiddenList.statusCode, 403);
  assert.equal(forbiddenList.json().error.code, "forbidden");

  const resolve = await app.inject({
    method: "POST",
    url: `/admin/disputes/${requestId}/resolve`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { outcome: "refund_full", resolution: "Dano confirmado nas fotos, reembolso total.", charge_provider: true },
  });
  assert.equal(resolve.statusCode, 200);
  const body = resolve.json().data;
  assert.equal(body.dispute.outcome, "refund_full");
  assert.ok(body.dispute.refund_id);
  refundIds.push(body.dispute.refund_id);

  const [refundRow] = await db.select().from(schema.refunds).where(inArray(schema.refunds.id, [body.dispute.refund_id]));
  assert.equal(refundRow?.amountKz, 12000);
  assert.equal(refundRow?.source, "dispute");
  assert.equal(refundRow?.chargeProvider, true);
});
