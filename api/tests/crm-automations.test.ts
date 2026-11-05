import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { newCsrfSecret, computeCsrfToken } from "../src/lib/csrf";

let app: FastifyInstance;

const accountIds: string[] = [];
const automationIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-automations-${randomUUID()}@angoleva.ao`;
  await db.insert(schema.accounts).values({ id, kind: "admin", email, fullName: name, active: true, adminRole: "admin", passwordHash: null });
  accountIds.push(id);
  return { id, email };
}

async function auth(name?: string) {
  const admin = await insertAdminAccount(name);
  const sessionId = newId("asess");
  const csrfSecret = newCsrfSecret();
  await db.insert(schema.adminSessions).values({ id: sessionId, accountId: admin.id, csrfSecret, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return { admin, cookieValue: app.signCookie(sessionId), csrfToken: computeCsrfToken(csrfSecret) };
}

async function createAutomation(session: Awaited<ReturnType<typeof auth>>) {
  const create = await app.inject({
    method: "POST",
    url: "/crm/automations",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: {},
  });
  const id = create.json().data.id as string;
  automationIds.push(id);
  return { response: create, id };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (automationIds.length > 0) {
    await db.delete(schema.crmAutomations).where(inArray(schema.crmAutomations.id, automationIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("listar automações devolve as automações criadas", async () => {
  const session = await auth();
  await createAutomation(session);

  const list = await app.inject({ method: "GET", url: "/crm/automations", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(Array.isArray(list.json().data));
});

test("criar uma automação começa em Rascunho sem passos", async () => {
  const session = await auth();
  const { response } = await createAutomation(session);
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.status, "Rascunho");
  assert.deepEqual(response.json().data.steps, []);
});

test("pausar uma automação em rascunho é uma transição válida", async () => {
  const session = await auth();
  const { id } = await createAutomation(session);

  const pause = await app.inject({
    method: "PATCH",
    url: `/crm/automations/${id}/status`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Pausada" },
  });
  assert.equal(pause.statusCode, 200);
  assert.equal(pause.json().data.status, "Pausada");
});

test("ativar uma automação sem passos é rejeitado por regra de negócio", async () => {
  const session = await auth();
  const { id } = await createAutomation(session);

  const activate = await app.inject({
    method: "PATCH",
    url: `/crm/automations/${id}/status`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Ativa" },
  });
  assert.equal(activate.statusCode, 422);
  assert.equal(activate.json().error.code, "validation");
});

test("remover uma automação fora de rascunho é rejeitado por regra de negócio", async () => {
  const session = await auth();
  const { id } = await createAutomation(session);

  await app.inject({
    method: "PATCH",
    url: `/crm/automations/${id}/status`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Pausada" },
  });

  const remove = await app.inject({
    method: "DELETE",
    url: `/crm/automations/${id}`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(remove.statusCode, 409);
  assert.equal(remove.json().error.code, "invalid_transition");
});

test("remover uma automação em rascunho é permitido", async () => {
  const session = await auth();
  const { id } = await createAutomation(session);

  const remove = await app.inject({
    method: "DELETE",
    url: `/crm/automations/${id}`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(remove.statusCode, 200);

  const getAfter = await db.select().from(schema.crmAutomations).where(inArray(schema.crmAutomations.id, [id]));
  assert.equal(getAfter.length, 0);
  automationIds.splice(automationIds.indexOf(id), 1);
});
