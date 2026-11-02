import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { newCsrfSecret, computeCsrfToken } from "../src/lib/csrf";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

const accountIds: string[] = [];
const testEmails: string[] = [];

function testEmail() {
  const email = `teste-painel-${randomUUID()}@angoleva.ao`;
  testEmails.push(email);
  return email;
}

async function insertAdminAccount(role: "admin" | "operations" | "support" | "finance", active = true) {
  const email = testEmail();
  const id = newId("acc");
  await db.insert(schema.accounts).values({
    id,
    kind: "admin",
    email,
    fullName: `Utilizador de Teste ${role}`,
    active,
    adminRole: role,
    passwordHash: null,
  });
  accountIds.push(id);
  return { id, email };
}

async function createSessionFor(accountId: string, overrides: { expiresAt?: Date; revokedAt?: Date | null } = {}) {
  const sessionId = newId("asess");
  const csrfSecret = newCsrfSecret();
  await db.insert(schema.adminSessions).values({
    id: sessionId,
    accountId,
    csrfSecret,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: overrides.revokedAt ?? null,
  });
  const cookieValue = app.signCookie(sessionId);
  const csrfToken = computeCsrfToken(csrfSecret);
  return { sessionId, cookieValue, csrfToken };
}

async function captureMailedCode(fn: () => Promise<unknown>) {
  const original = console.log;
  let captured = "";
  console.log = (...args: unknown[]) => {
    captured += args.join(" ");
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

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (accountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, accountIds));
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, accountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  if (testEmails.length > 0) {
    await db.delete(schema.otpCodes).where(inArray(schema.otpCodes.email, testEmails));
  }
  await app.close();
});

test("pedir código e entrar com o código certo cria sessão com cookie e csrf", async () => {
  const admin = await insertAdminAccount("admin");

  const code = await captureMailedCode(() =>
    app.inject({ method: "POST", url: "/admin/auth/request-code", payload: { email: admin.email } }),
  );

  const response = await app.inject({ method: "POST", url: "/admin/auth/login", payload: { email: admin.email, code } });
  assert.equal(response.statusCode, 200);

  const body = response.json();
  assert.ok(body.data.token);
  assert.ok(body.data.csrf_token);
  assert.equal(body.data.user.email, admin.email);
  assert.equal(body.data.user.role, "admin");

  const setCookie = response.headers["set-cookie"];
  assert.ok(setCookie, "a resposta deve definir o cookie de sessão");
  const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  assert.match(cookieHeader, /admin_session=/);
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /Secure/i);
  assert.match(cookieHeader, /SameSite=Strict/i);
});

test("código errado falha com unauthorized", async () => {
  const admin = await insertAdminAccount("admin");

  await captureMailedCode(() => app.inject({ method: "POST", url: "/admin/auth/request-code", payload: { email: admin.email } }));

  const response = await app.inject({ method: "POST", url: "/admin/auth/login", payload: { email: admin.email, code: "000000" } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthorized");
});

test("sessão expirada é rejeitada num endpoint protegido", async () => {
  const admin = await insertAdminAccount("admin");
  const { cookieValue } = await createSessionFor(admin.id, { expiresAt: new Date(Date.now() - 60 * 1000) });

  const response = await app.inject({ method: "GET", url: "/admin/users", cookies: { admin_session: cookieValue } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthorized");
});

test("sessão revogada é rejeitada num endpoint protegido", async () => {
  const admin = await insertAdminAccount("admin");
  const { cookieValue } = await createSessionFor(admin.id, { revokedAt: new Date() });

  const response = await app.inject({ method: "GET", url: "/admin/users", cookies: { admin_session: cookieValue } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthorized");
});

test("GET /admin/auth/session devolve null sem cookie e os dados da sessão com um cookie válido", async () => {
  const admin = await insertAdminAccount("admin");
  const { cookieValue } = await createSessionFor(admin.id);

  const withoutCookie = await app.inject({ method: "GET", url: "/admin/auth/session" });
  assert.equal(withoutCookie.statusCode, 200);
  assert.equal(withoutCookie.json().data, null);

  const withCookie = await app.inject({ method: "GET", url: "/admin/auth/session", cookies: { admin_session: cookieValue } });
  assert.equal(withCookie.statusCode, 200);
  assert.equal(withCookie.json().data.user.email, admin.email);
});

test("createUser sem reason falha com validation", async () => {
  const admin = await insertAdminAccount("admin");
  const { cookieValue, csrfToken } = await createSessionFor(admin.id);

  const response = await app.inject({
    method: "POST",
    url: "/admin/users",
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { name: "Novo Utilizador de Teste", email: testEmail(), role: "operations" },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "validation");
});

test("createUser, changeRole e setActive por um papel que não é admin falham com forbidden", async () => {
  const supportUser = await insertAdminAccount("support");
  const { cookieValue, csrfToken } = await createSessionFor(supportUser.id);

  const createResponse = await app.inject({
    method: "POST",
    url: "/admin/users",
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { name: "Outro Utilizador", email: testEmail(), role: "operations", reason: "Teste de permissões" },
  });
  assert.equal(createResponse.statusCode, 403);
  assert.equal(createResponse.json().error.code, "forbidden");

  const roleResponse = await app.inject({
    method: "PATCH",
    url: `/admin/users/${supportUser.id}/role`,
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { role: "finance", reason: "Teste de permissões" },
  });
  assert.equal(roleResponse.statusCode, 403);
  assert.equal(roleResponse.json().error.code, "forbidden");

  const activeResponse = await app.inject({
    method: "PATCH",
    url: `/admin/users/${supportUser.id}/active`,
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { active: false, reason: "Teste de permissões" },
  });
  assert.equal(activeResponse.statusCode, 403);
  assert.equal(activeResponse.json().error.code, "forbidden");
});

test("mutação sem cabeçalho CSRF ou com um CSRF errado falha", async () => {
  const admin = await insertAdminAccount("admin");
  const { cookieValue } = await createSessionFor(admin.id);

  const withoutCsrf = await app.inject({
    method: "POST",
    url: "/admin/users",
    cookies: { admin_session: cookieValue },
    payload: { name: "Sem CSRF", email: testEmail(), role: "operations", reason: "Teste CSRF" },
  });
  assert.equal(withoutCsrf.statusCode, 403);
  assert.equal(withoutCsrf.json().error.code, "forbidden");

  const withWrongCsrf = await app.inject({
    method: "POST",
    url: "/admin/users",
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": "token-errado" },
    payload: { name: "CSRF Errado", email: testEmail(), role: "operations", reason: "Teste CSRF" },
  });
  assert.equal(withWrongCsrf.statusCode, 403);
  assert.equal(withWrongCsrf.json().error.code, "forbidden");
});

test("createUser, changeRole e setActive por um admin têm sucesso e ficam auditados", async () => {
  const admin = await insertAdminAccount("admin");
  const { cookieValue, csrfToken } = await createSessionFor(admin.id);
  const newEmail = testEmail();

  const createResponse = await app.inject({
    method: "POST",
    url: "/admin/users",
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { name: "Utilizador Criado no Teste", email: newEmail, role: "operations", reason: "Precisa de acesso às operações" },
  });
  assert.equal(createResponse.statusCode, 200);
  const created = createResponse.json().data;
  assert.equal(created.role, "operations");
  accountIds.push(created.id);

  const roleResponse = await app.inject({
    method: "PATCH",
    url: `/admin/users/${created.id}/role`,
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { role: "finance", reason: "Mudou de equipa" },
  });
  assert.equal(roleResponse.statusCode, 200);
  assert.equal(roleResponse.json().data.role, "finance");

  const activeResponse = await app.inject({
    method: "PATCH",
    url: `/admin/users/${created.id}/active`,
    cookies: { admin_session: cookieValue },
    headers: { "x-csrf-token": csrfToken },
    payload: { active: false, reason: "Saiu da empresa" },
  });
  assert.equal(activeResponse.statusCode, 200);
  assert.equal(activeResponse.json().data.active, false);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [created.id]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["admin_user.create", "admin_user.deactivate", "admin_user.role"].sort());
});
