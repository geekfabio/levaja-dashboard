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
const companyIds: string[] = [];

async function insertAdminAccount() {
  const id = newId("acc");
  const email = `teste-crm-companies-${randomUUID()}@angoleva.ao`;
  await db.insert(schema.accounts).values({ id, kind: "admin", email, fullName: "Gestora de Teste", active: true, adminRole: "admin", passwordHash: null });
  accountIds.push(id);
  return { id, email };
}

async function createSessionFor(accountId: string) {
  const sessionId = newId("asess");
  const csrfSecret = newCsrfSecret();
  await db.insert(schema.adminSessions).values({ id: sessionId, accountId, csrfSecret, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return { cookieValue: app.signCookie(sessionId), csrfToken: computeCsrfToken(csrfSecret) };
}

async function auth() {
  const admin = await insertAdminAccount();
  const session = await createSessionFor(admin.id);
  return { admin, ...session };
}

function companyId(tag: string) {
  const id = `empresa-teste-${tag}-${randomUUID().slice(0, 8)}`;
  companyIds.push(id);
  return id;
}

function createPayload(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Mercearia de Teste",
    tags: ["Grossista"],
    owner: "Sara Neto",
    zone: "Luanda",
    open_deals: 2,
    pipeline_value_kz: 1_000_000,
    win_probability: 50,
    trend: [1, 2, 3],
    last_interaction: { date: "2026-10-01", label: "Visita" },
    activity_days: 10,
    ...overrides,
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (companyIds.length > 0) {
    await db.delete(schema.crmCompanies).where(inArray(schema.crmCompanies.id, companyIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("criar e listar um cliente", async () => {
  const session = await auth();
  const id = companyId("criar");

  const create = await app.inject({
    method: "POST",
    url: "/crm/companies",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(id),
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().data.id, id);
  assert.equal(create.json().data.pipeline_value_kz, 1_000_000);

  const list = await app.inject({ method: "GET", url: "/crm/companies", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === id));
});

test("criar um cliente com identificador repetido falha com validation", async () => {
  const session = await auth();
  const id = companyId("duplicado");

  await app.inject({
    method: "POST",
    url: "/crm/companies",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(id),
  });

  const second = await app.inject({
    method: "POST",
    url: "/crm/companies",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(id),
  });
  assert.equal(second.statusCode, 422);
  assert.equal(second.json().error.code, "validation");
});

test("actualizar um cliente aplica apenas os campos indicados", async () => {
  const session = await auth();
  const id = companyId("actualizar");

  await app.inject({
    method: "POST",
    url: "/crm/companies",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(id),
  });

  const update = await app.inject({
    method: "PATCH",
    url: `/crm/companies/${id}`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { owner: "Jaime Teixeira", pipeline_value_kz: 2_000_000 },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.owner, "Jaime Teixeira");
  assert.equal(update.json().data.pipeline_value_kz, 2_000_000);
  assert.equal(update.json().data.name, "Mercearia de Teste");
});

test("actualizar um cliente que não existe falha com not_found", async () => {
  const session = await auth();

  const update = await app.inject({
    method: "PATCH",
    url: "/crm/companies/nao-existe",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { owner: "Alguém" },
  });
  assert.equal(update.statusCode, 404);
  assert.equal(update.json().error.code, "not_found");
});

test("arquivar marca archived e a listagem em bulk devolve só os ids pedidos", async () => {
  const session = await auth();
  const idA = companyId("arquivar-a");
  const idB = companyId("arquivar-b");

  await app.inject({ method: "POST", url: "/crm/companies", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(idA) });
  await app.inject({ method: "POST", url: "/crm/companies", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(idB) });

  const archive = await app.inject({
    method: "POST",
    url: "/crm/companies/archive",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { ids: [idA] },
  });
  assert.equal(archive.statusCode, 200);
  assert.equal(archive.json().data.length, 1);
  assert.equal(archive.json().data[0].archived, true);

  const get = await app.inject({ method: "GET", url: `/crm/companies/${idB}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(get.json().data.archived, false);
});

test("registar contacto não recua a data quando já há um contacto mais recente", async () => {
  const session = await auth();
  const id = companyId("contacto");

  await app.inject({
    method: "POST",
    url: "/crm/companies",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(id, { last_interaction: { date: "2026-10-20", label: "Reunião" } }),
  });

  const older = await app.inject({
    method: "POST",
    url: `/crm/companies/${id}/contact`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { date: "2026-09-01", label: "Chamada antiga" },
  });
  assert.equal(older.statusCode, 204);

  const afterOlder = await app.inject({ method: "GET", url: `/crm/companies/${id}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(afterOlder.json().data.last_interaction.label, "Reunião");

  const newer = await app.inject({
    method: "POST",
    url: `/crm/companies/${id}/contact`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { date: "2026-11-01", label: "Chamada recente" },
  });
  assert.equal(newer.statusCode, 204);

  const afterNewer = await app.inject({ method: "GET", url: `/crm/companies/${id}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(afterNewer.json().data.last_interaction.label, "Chamada recente");
});

test("sem sessão de admin falha com unauthorized e sem csrf falha com forbidden", async () => {
  const noSession = await app.inject({ method: "GET", url: "/crm/companies" });
  assert.equal(noSession.statusCode, 401);
  assert.equal(noSession.json().error.code, "unauthorized");

  const session = await auth();
  const withoutCsrf = await app.inject({
    method: "POST",
    url: "/crm/companies",
    cookies: { admin_session: session.cookieValue },
    payload: createPayload(companyId("sem-csrf")),
  });
  assert.equal(withoutCsrf.statusCode, 403);
  assert.equal(withoutCsrf.json().error.code, "forbidden");
});
