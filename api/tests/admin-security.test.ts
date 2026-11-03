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
const adminEmails: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (adminEmails.length > 0) {
    await db.delete(schema.adminAccessLog).where(inArray(schema.adminAccessLog.email, adminEmails));
    await db.delete(schema.otpCodes).where(inArray(schema.otpCodes.email, adminEmails));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAccessLog).where(inArray(schema.adminAccessLog.accountId, adminAccountIds));
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

  const accessRows = await db.select().from(schema.adminAccessLog).where(inArray(schema.adminAccessLog.accountId, [otherAdmin.id]));
  assert.ok(accessRows.some((row) => row.result === "revoked"));
});

async function captureMailedCode(fn: () => Promise<unknown>) {
  const original = console.log;
  let captured = "";
  console.log = (...args: unknown[]) => {
    captured += args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
  };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  const match = captured.match(/é (\d{6})\./);
  if (!match) throw new Error("Não foi possível capturar o código enviado por email.");
  return match[1]!;
}

test("login bem-sucedido e código errado ficam no registo de acessos; suporte não vê o registo (forbidden)", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  adminEmails.push(admin.email);

  const code = await captureMailedCode(() => app.inject({ method: "POST", url: "/admin/auth/request-code", payload: { email: admin.email } }));

  const wrong = await app.inject({ method: "POST", url: "/admin/auth/login", payload: { email: admin.email, code: "000000" } });
  assert.equal(wrong.statusCode, 401);

  const ok = await app.inject({ method: "POST", url: "/admin/auth/login", payload: { email: admin.email, code } });
  assert.equal(ok.statusCode, 200);

  const session = await createAdminSession(app, admin.id);

  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const forbidden = await app.inject({ method: "GET", url: "/admin/security/access-log", cookies: supportSession.cookies });
  assert.equal(forbidden.statusCode, 403);

  const list = await app.inject({ method: "GET", url: `/admin/security/access-log?q=${encodeURIComponent(admin.email)}`, cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  const results = list.json().data.map((item: { result: string }) => item.result);
  assert.ok(results.includes("success"));
  assert.ok(results.includes("wrong_code"));

  const filtered = await app.inject({
    method: "GET",
    url: `/admin/security/access-log?result=wrong_code&q=${encodeURIComponent(admin.email)}`,
    cookies: session.cookies,
  });
  assert.equal(filtered.statusCode, 200);
  assert.ok(filtered.json().data.every((item: { result: string }) => item.result === "wrong_code"));
});

test("activar e desactivar o segundo factor; suporte não pode (forbidden); repetir o mesmo estado falha", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const target = await insertAdminAccount("operations");
  adminAccountIds.push(target.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/security/users/${target.id}/two-factor`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { enabled: true, reason: "Suporte a tentar activar." },
  });
  assert.equal(forbidden.statusCode, 403);

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/security/users/${target.id}/two-factor`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { enabled: true },
  });
  assert.equal(noReason.statusCode, 422);

  const enable = await app.inject({
    method: "POST",
    url: `/admin/security/users/${target.id}/two-factor`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { enabled: true, reason: "Reforçar segurança da conta." },
  });
  assert.equal(enable.statusCode, 200);
  assert.equal(enable.json().data.two_factor_enabled, true);

  const repeat = await app.inject({
    method: "POST",
    url: `/admin/security/users/${target.id}/two-factor`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { enabled: true, reason: "Repetir." },
  });
  assert.equal(repeat.statusCode, 409);

  const disable = await app.inject({
    method: "POST",
    url: `/admin/security/users/${target.id}/two-factor`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { enabled: false, reason: "Já não é preciso." },
  });
  assert.equal(disable.statusCode, 200);
  assert.equal(disable.json().data.two_factor_enabled, false);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [target.id]));
  assert.ok(auditRows.some((row) => row.action === "security.two_factor"));
});
