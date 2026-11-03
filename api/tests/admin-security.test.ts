import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
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
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

test("lista sessões activas, incluindo a própria marcada como actual", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const list = await app.inject({ method: "GET", url: "/admin/security/sessions", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  const own = list.json().data.find((item: { id: string }) => item.id === session.sessionId);
  assert.ok(own);
  assert.equal(own.current, true);
});

test("suporte não pode gerir segurança (forbidden); administrador revoga sessão de outro com motivo e fica auditado", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const otherAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(otherAdmin.id);
  const otherSession = await createAdminSession(app, otherAdmin.id);

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/security/sessions/${otherSession.sessionId}/revoke`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Suporte a tentar revogar." },
  });
  assert.equal(forbidden.statusCode, 403);

  const ownSession = await app.inject({
    method: "POST",
    url: `/admin/security/sessions/${session.sessionId}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "A tentar revogar a própria sessão." },
  });
  assert.equal(ownSession.statusCode, 422);

  const revoke = await app.inject({
    method: "POST",
    url: `/admin/security/sessions/${otherSession.sessionId}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Dispositivo desconhecido." },
  });
  assert.equal(revoke.statusCode, 200);

  const revokeAgain = await app.inject({
    method: "POST",
    url: `/admin/security/sessions/${otherSession.sessionId}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetir." },
  });
  assert.equal(revokeAgain.statusCode, 409);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [otherSession.sessionId]));
  assert.ok(auditRows.some((row) => row.action === "security.session_revoke"));

  const list = await app.inject({ method: "GET", url: "/admin/security/sessions", cookies: session.cookies });
  assert.ok(!list.json().data.some((item: { id: string }) => item.id === otherSession.sessionId));
});
