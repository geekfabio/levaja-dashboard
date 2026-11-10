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
const claimIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (claimIds.length > 0) {
    await db.delete(schema.claims).where(inArray(schema.claims.id, claimIds));
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

async function createDeliveredRequest(clientId: string, providerId: string | null, status: "delivered" | "paid" | "searching" = "delivered") {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status,
    clientAccountId: clientId,
    providerAccountId: providerId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    dropoff: placeFixture("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [{ id: "ph-1", stage: "damage", label: "Dano na carga", at: new Date().toISOString(), by: "client" }],
    pickupPhotos: [],
    paymentMethod: "cash",
  });
  requestIds.push(id);
  return { id, code };
}

test("participa um sinistro, entra em análise, aprova e paga", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("claim-flow");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("claim-flow");
  userAccountIds.push(provider.id);
  const { id: requestId, code } = await createDeliveredRequest(client.id, provider.id);

  const report = await app.inject({
    method: "POST",
    url: "/admin/claims",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: {
      request_id: requestId,
      kind: "cargo_damage",
      description: "Caixa de electrodomésticos chegou com danos visíveis.",
      estimated_amount_kz: 20000,
      occurred_at: new Date().toISOString(),
    },
  });
  assert.equal(report.statusCode, 200);
  const claim = report.json().data;
  claimIds.push(claim.id);
  assert.equal(claim.status, "reported");
  assert.equal(claim.request_code, code);
  assert.deepEqual(claim.photo_ids, ["ph-1"]);

  const list = await app.inject({ method: "GET", url: "/admin/claims", cookies: opsSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === claim.id));

  const forRequest = await app.inject({ method: "GET", url: `/admin/requests/${requestId}/claims`, cookies: opsSession.cookies });
  assert.equal(forRequest.statusCode, 200);
  assert.equal(forRequest.json().data.length, 1);

  const review = await app.inject({
    method: "POST",
    url: `/admin/claims/${claim.id}/start-review`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { insurer: "Seguradora Angolana", policy_number: "POL-9001" },
  });
  assert.equal(review.statusCode, 200);
  assert.equal(review.json().data.status, "under_review");

  // Regra de negócio: a indemnização não pode passar 150% do valor estimado.
  const tooHigh = await app.inject({
    method: "POST",
    url: `/admin/claims/${claim.id}/approve`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { amount_kz: 35000, reason: "Valor acima do limite de teste." },
  });
  assert.equal(tooHigh.statusCode, 422);
  assert.equal(tooHigh.json().error.code, "validation");

  const approve = await app.inject({
    method: "POST",
    url: `/admin/claims/${claim.id}/approve`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { amount_kz: 18000, reason: "Dano confirmado pela seguradora." },
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().data.status, "approved");
  assert.equal(approve.json().data.approved_amount_kz, 18000);

  const markPaid = await app.inject({
    method: "POST",
    url: `/admin/claims/${claim.id}/mark-paid`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { payment_reference: "SEG-REF-01" },
  });
  assert.equal(markPaid.statusCode, 200);
  assert.equal(markPaid.json().data.status, "paid");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [claim.id]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["claim.approve", "claim.paid", "claim.report", "claim.review"]);
});

test("suporte não gere sinistros (forbidden); só se participa depois da recolha (invalid_transition)", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("claim-forbidden");
  userAccountIds.push(client.id);
  const { id: notYetCollected } = await createDeliveredRequest(client.id, null, "searching");

  const tooEarly = await app.inject({
    method: "POST",
    url: "/admin/claims",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: {
      request_id: notYetCollected,
      kind: "cargo_damage",
      description: "Tentativa antes da recolha.",
      estimated_amount_kz: 5000,
      occurred_at: new Date().toISOString(),
    },
  });
  assert.equal(tooEarly.statusCode, 409);
  assert.equal(tooEarly.json().error.code, "invalid_transition");

  const { id: requestId } = await createDeliveredRequest(client.id, null, "delivered");
  const report = await app.inject({
    method: "POST",
    url: "/admin/claims",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: {
      request_id: requestId,
      kind: "vehicle_damage",
      description: "Risco na viatura durante o transporte.",
      estimated_amount_kz: 7000,
      occurred_at: new Date().toISOString(),
    },
  });
  assert.equal(report.statusCode, 200);
  claimIds.push(report.json().data.id);

  const manageForbidden = await app.inject({
    method: "POST",
    url: `/admin/claims/${report.json().data.id}/start-review`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { insurer: "Seguradora", policy_number: "POL-1" },
  });
  assert.equal(manageForbidden.statusCode, 403);
  assert.equal(manageForbidden.json().error.code, "forbidden");
});
