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
const activityIds: string[] = [];
const taskIds: string[] = [];
const companyIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-activities-${randomUUID()}@angoleva.ao`;
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

async function createCompany() {
  const id = `empresa-teste-${randomUUID().slice(0, 8)}`;
  companyIds.push(id);
  await db.insert(schema.crmCompanies).values({ id, name: "Empresa de Teste" });
  return id;
}

function activityId(tag: string) {
  const id = `actividade-teste-${tag}-${randomUUID().slice(0, 8)}`;
  activityIds.push(id);
  return id;
}

function taskId(tag: string) {
  const id = `tarefa-teste-${tag}-${randomUUID().slice(0, 8)}`;
  taskIds.push(id);
  return id;
}

function activityPayload(id: string, companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "Visita",
    company_id: companyId,
    company_name: "Empresa de Teste",
    owner: "Sara Neto",
    zone: "Luanda",
    date: "2026-10-09T10:00:00.000Z",
    note: "Visita de rotina.",
    ...overrides,
  };
}

function taskPayload(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "Confirmar reposição de stock",
    assignee: "Sara Neto",
    due_date: "2026-10-09T00:00:00.000Z",
    ...overrides,
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (activityIds.length > 0) {
    await db.delete(schema.crmActivities).where(inArray(schema.crmActivities.id, activityIds));
  }
  if (taskIds.length > 0) {
    await db.delete(schema.crmTasks).where(inArray(schema.crmTasks.id, taskIds));
  }
  if (companyIds.length > 0) {
    await db.delete(schema.crmCompanies).where(inArray(schema.crmCompanies.id, companyIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("criar e listar um registo de actividade", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const id = activityId("criar");

  const create = await app.inject({
    method: "POST",
    url: "/crm/activities",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: activityPayload(id, companyId),
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().data.type, "Visita");
  assert.equal(create.json().data.company_id, companyId);

  const list = await app.inject({ method: "GET", url: "/crm/activities", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === id));
});

test("remover e restaurar um registo de actividade", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const id = activityId("remover");

  await app.inject({
    method: "POST",
    url: "/crm/activities",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: activityPayload(id, companyId),
  });

  const remove = await app.inject({
    method: "DELETE",
    url: `/crm/activities/${id}`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(remove.statusCode, 200);

  const gone = await app.inject({ method: "GET", url: `/crm/activities/${id}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(gone.statusCode, 404);

  const restore = await app.inject({
    method: "PUT",
    url: `/crm/activities/${id}/restore`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: activityPayload(id, companyId),
  });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().data.id, id);
});

test("obter um registo inexistente falha com not_found", async () => {
  const session = await auth();
  const response = await app.inject({ method: "GET", url: "/crm/activities/nao-existe", cookies: { admin_session: session.cookieValue } });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
});

test("criar e mover o estado de uma tarefa", async () => {
  const session = await auth();
  const id = taskId("mover");

  const create = await app.inject({
    method: "POST",
    url: "/crm/tasks",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: taskPayload(id),
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().data.status, "Por Fazer");

  const move = await app.inject({
    method: "PATCH",
    url: `/crm/tasks/${id}/status`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Feita" },
  });
  assert.equal(move.statusCode, 200);
  assert.equal(move.json().data.status, "Feita");
});

test("adiar uma tarefa altera a data limite", async () => {
  const session = await auth();
  const id = taskId("adiar");

  await app.inject({
    method: "POST",
    url: "/crm/tasks",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: taskPayload(id),
  });

  const postpone = await app.inject({
    method: "PATCH",
    url: `/crm/tasks/${id}/postpone`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { due_date: "2026-11-01T00:00:00.000Z" },
  });
  assert.equal(postpone.statusCode, 200);
  assert.equal(postpone.json().data.due_date, "2026-11-01T00:00:00.000Z");
});
