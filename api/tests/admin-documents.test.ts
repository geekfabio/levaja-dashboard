import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertProviderAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const providerAccountIds: string[] = [];
const documentIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (documentIds.length > 0) {
    await db.delete(schema.providerDocuments).where(inArray(schema.providerDocuments.id, documentIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...providerAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

async function insertDocument(providerAccountId: string, kind: string, status: "pending" | "verified" | "rejected", validUntil: Date | null = null) {
  const id = newId("doc");
  await db.insert(schema.providerDocuments).values({ id, providerAccountId, title: `Documento ${kind}`, kind, status, validUntil });
  documentIds.push(id);
  return id;
}

test("fila de documentos lista pendentes por omissão", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const provider = await insertProviderAccount("doc-queue");
  providerAccountIds.push(provider.id);
  const docId = await insertDocument(provider.id, "license", "pending");

  const queue = await app.inject({ method: "GET", url: "/admin/documents", cookies: session.cookies });
  assert.equal(queue.statusCode, 200);
  assert.ok(queue.json().data.some((item: { id: string }) => item.id === docId));
});

test("finanças não pode aprovar documentos (forbidden); operações aprova com validade futura e fica auditado", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const provider = await insertProviderAccount("doc-approve");
  providerAccountIds.push(provider.id);
  const docId = await insertDocument(provider.id, "insurance", "pending");

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/documents/${docId}/approve`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
  });
  assert.equal(forbidden.statusCode, 403);

  const pastDate = await app.inject({
    method: "POST",
    url: `/admin/documents/${docId}/approve`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { valid_until: new Date(Date.now() - 1000).toISOString() },
  });
  assert.equal(pastDate.statusCode, 422);
  assert.equal(pastDate.json().error.code, "validation");

  const approve = await app.inject({
    method: "POST",
    url: `/admin/documents/${docId}/approve`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() },
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().data.status, "verified");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [docId]));
  assert.ok(auditRows.some((row) => row.action === "document.approve"));
});

test("recusar exige motivo e muda o estado; aparece em expiring quando perto da validade", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const provider = await insertProviderAccount("doc-reject");
  providerAccountIds.push(provider.id);
  const docId = await insertDocument(provider.id, "vehicle", "pending");

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/documents/${docId}/reject`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: {},
  });
  assert.equal(noReason.statusCode, 422);

  const reject = await app.inject({
    method: "POST",
    url: `/admin/documents/${docId}/reject`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Documento ilegível." },
  });
  assert.equal(reject.statusCode, 200);
  assert.equal(reject.json().data.status, "rejected");

  const expiringProvider = await insertProviderAccount("doc-expiring");
  providerAccountIds.push(expiringProvider.id);
  const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const expiringDocId = await insertDocument(expiringProvider.id, "license", "verified", soon);

  const expiring = await app.inject({ method: "GET", url: "/admin/documents/expiring?within_days=10", cookies: opsSession.cookies });
  assert.equal(expiring.statusCode, 200);
  assert.ok(expiring.json().data.some((item: { id: string }) => item.id === expiringDocId));
});
