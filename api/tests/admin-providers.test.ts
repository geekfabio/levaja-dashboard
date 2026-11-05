import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
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
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, providerAccountIds));
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

async function insertDocument(providerAccountId: string, kind: string, status: "pending" | "verified" | "rejected", validUntil: Date | null) {
  const id = newId("doc");
  await db.insert(schema.providerDocuments).values({ id, providerAccountId, title: kind, kind, status, validUntil });
  documentIds.push(id);
  return id;
}

async function verifyAllDocuments(providerAccountId: string) {
  const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  for (const kind of ["license", "id", "vehicle", "insurance"]) {
    await insertDocument(providerAccountId, kind, "verified", validUntil);
  }
}

test("lista prestadores e lê um prestador", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const provider = await insertProviderAccount("list");
  providerAccountIds.push(provider.id);

  const list = await app.inject({ method: "GET", url: "/admin/providers", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === provider.id));

  const get = await app.inject({ method: "GET", url: `/admin/providers/${provider.id}`, cookies: session.cookies });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.id, provider.id);
  assert.equal(get.json().data.account_status, "active");
});

test("suporte não pode aprovar prestadores (forbidden); admin aprova com documentos e fica auditado", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const provider = await insertProviderAccount("approve", { accountStatus: "pending_approval" });
  providerAccountIds.push(provider.id);

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/approve`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Suporte a tentar aprovar." },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const missingDocs = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Documentos em falta." },
  });
  assert.equal(missingDocs.statusCode, 422);
  assert.equal(missingDocs.json().error.code, "validation");

  await verifyAllDocuments(provider.id);

  const approve = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Documentos validados." },
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().data.account_status, "active");

  const again = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetir." },
  });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().error.code, "invalid_transition");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [provider.id]));
  assert.ok(auditRows.some((row) => row.action === "provider.approve"));
});

test("suspender exige motivo e bloqueia quando há pedido em curso; reactivar exige estado suspenso", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const provider = await insertProviderAccount("suspend");
  providerAccountIds.push(provider.id);

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/suspend`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(noReason.statusCode, 422);

  const suspend = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/suspend`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Reclamações repetidas." },
  });
  assert.equal(suspend.statusCode, 200);
  assert.equal(suspend.json().data.account_status, "suspended");
  assert.equal(suspend.json().data.availability, "offline");

  const neverSuspended = await insertProviderAccount("reactivate-wrong");
  providerAccountIds.push(neverSuspended.id);
  const reactivateWrong = await app.inject({
    method: "POST",
    url: `/admin/providers/${neverSuspended.id}/reactivate`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Não estava suspenso." },
  });
  assert.equal(reactivateWrong.statusCode, 409);

  const reactivate = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/reactivate`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Resolvido." },
  });
  assert.equal(reactivate.statusCode, 200);
  assert.equal(reactivate.json().data.account_status, "active");
});

test("positions só devolve prestadores online e activos", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const online = await insertProviderAccount("positions-online", { online: true, accountStatus: "active" });
  providerAccountIds.push(online.id);
  const offline = await insertProviderAccount("positions-offline", { online: false, accountStatus: "active" });
  providerAccountIds.push(offline.id);

  await db.update(schema.providers).set({ lat: "-8.8", lng: "13.2" }).where(eq(schema.providers.accountId, online.id));

  const positions = await app.inject({ method: "GET", url: "/admin/providers/positions", cookies: session.cookies });
  assert.equal(positions.statusCode, 200);
  const ids = positions.json().data.map((item: { id: string }) => item.id);
  assert.ok(ids.includes(online.id));
  assert.ok(!ids.includes(offline.id));
});
