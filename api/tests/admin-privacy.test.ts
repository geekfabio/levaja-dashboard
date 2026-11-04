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
const privacyRequestIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (privacyRequestIds.length > 0) {
    await db.delete(schema.privacyRequests).where(inArray(schema.privacyRequests.id, privacyRequestIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (userAccountIds.length > 0) {
    await db.delete(schema.clientAddresses).where(inArray(schema.clientAddresses.clientAccountId, userAccountIds));
    await db.delete(schema.clientPaymentMethods).where(inArray(schema.clientPaymentMethods.clientAccountId, userAccountIds));
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

async function insertPrivacyRequest(options: {
  subjectKind: "client" | "provider";
  subjectAccountId: string;
  subjectName: string;
  kind: "access" | "rectification" | "erasure" | "portability" | "objection";
  daysAgo?: number;
}) {
  const id = newId("pd");
  const code = `PD-${1000 + Math.floor(Math.random() * 9000)}`;
  const receivedAt = new Date(Date.now() - (options.daysAgo ?? 2) * 86_400_000);
  const dueAt = new Date(receivedAt.getTime() + 30 * 86_400_000);
  await db.insert(schema.privacyRequests).values({
    id,
    code,
    subjectKind: options.subjectKind,
    subjectAccountId: options.subjectAccountId,
    subjectName: options.subjectName,
    kind: options.kind,
    channel: "app",
    details: "Pedido de teste.",
    receivedAt,
    dueAt,
    status: "received",
  });
  privacyRequestIds.push(id);
  return { id, code };
}

async function createSettledRequest(clientId: string, providerId: string) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status: "paid",
    clientAccountId: clientId,
    providerAccountId: providerId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    dropoff: placeFixture("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [],
    pickupPhotos: [],
    paymentMethod: "cash",
  });
  requestIds.push(id);
  return { id, code };
}

test("lista pedidos de dados, começa o tratamento e conclui com resolução", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const session = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("privacy-flow");
  userAccountIds.push(client.id);
  const { id: requestId, code } = await insertPrivacyRequest({
    subjectKind: "client",
    subjectAccountId: client.id,
    subjectName: "Cliente de teste",
    kind: "rectification",
  });

  const list = await app.inject({ method: "GET", url: "/admin/privacy/requests", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string; code: string }) => item.id === requestId && item.code === code));

  const summary = await app.inject({ method: "GET", url: "/admin/privacy/summary", cookies: session.cookies });
  assert.equal(summary.statusCode, 200);
  assert.ok(summary.json().data.open >= 1);

  const start = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${requestId}/start`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.json().data.status, "in_progress");

  const missingReason = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${requestId}/complete`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(missingReason.statusCode, 422);
  assert.equal(missingReason.json().error.code, "validation");

  const complete = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${requestId}/complete`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { resolution: "Nome corrigido nos recibos." },
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.json().data.status, "completed");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [requestId]));
  assert.deepEqual(
    auditRows.map((row) => row.action).sort(),
    ["privacy.complete", "privacy.start"],
  );
});

test("finanças não gere privacidade (forbidden)", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const session = await createAdminSession(app, financeAdmin.id);

  const client = await insertClientAccount("privacy-forbidden");
  userAccountIds.push(client.id);
  const { id: requestId } = await insertPrivacyRequest({
    subjectKind: "client",
    subjectAccountId: client.id,
    subjectName: "Cliente sem acesso",
    kind: "access",
  });

  const forbidden = await app.inject({ method: "GET", url: "/admin/privacy/requests", cookies: session.cookies });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const forbiddenGet = await app.inject({ method: "GET", url: `/admin/privacy/requests/${requestId}`, cookies: session.cookies });
  assert.equal(forbiddenGet.statusCode, 403);
});

test("eliminação é recusada enquanto o titular tem um pedido em curso, e anonimiza a conta depois de concluído", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const session = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("privacy-erasure");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("privacy-erasure");
  userAccountIds.push(provider.id);

  const activeId = newId("req");
  await db.insert(schema.serviceRequests).values({
    id: activeId,
    code: `AL-${20000 + Math.floor(Math.random() * 9000)}-${randomUUID().slice(0, 4)}`,
    serviceType: "cargo",
    status: "searching",
    clientAccountId: client.id,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    dropoff: null,
    stops: [],
    photos: [],
    pickupPhotos: [],
  });
  requestIds.push(activeId);

  const { id: requestId } = await insertPrivacyRequest({
    subjectKind: "client",
    subjectAccountId: client.id,
    subjectName: "Cliente a eliminar",
    kind: "erasure",
  });

  const blocked = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${requestId}/complete`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { resolution: "Eliminação pedida pelo titular." },
  });
  assert.equal(blocked.statusCode, 422);
  assert.equal(blocked.json().error.code, "validation");

  await db.update(schema.serviceRequests).set({ status: "cancelled" }).where(inArray(schema.serviceRequests.id, [activeId]));

  const completed = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${requestId}/complete`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { resolution: "Eliminação pedida pelo titular." },
  });
  assert.equal(completed.statusCode, 200);
  assert.equal(completed.json().data.status, "completed");

  const [account] = await db.select().from(schema.accounts).where(inArray(schema.accounts.id, [client.id]));
  assert.ok(account.fullName.startsWith("Titular removido"));
  assert.notEqual(account.email, client.email);
});

test("exportação de dados só existe para acesso/portabilidade e devolve o histórico do titular", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const session = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("privacy-export");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("privacy-export-provider");
  userAccountIds.push(provider.id);
  await createSettledRequest(client.id, provider.id);

  const { id: wrongKindId } = await insertPrivacyRequest({
    subjectKind: "client",
    subjectAccountId: client.id,
    subjectName: "Cliente de exportação",
    kind: "rectification",
  });
  const wrongKind = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${wrongKindId}/export`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(wrongKind.statusCode, 422);

  const { id: requestId } = await insertPrivacyRequest({
    subjectKind: "client",
    subjectAccountId: client.id,
    subjectName: "Cliente de exportação",
    kind: "access",
  });
  const exported = await app.inject({
    method: "POST",
    url: `/admin/privacy/requests/${requestId}/export`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(exported.statusCode, 200);
  const body = exported.json().data;
  assert.equal(body.subject, "Cliente de exportação");
  assert.equal(body.data.pedidos.length, 1);
});
