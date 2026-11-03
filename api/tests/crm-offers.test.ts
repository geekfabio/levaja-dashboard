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
const offerIds: string[] = [];
const companyIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-offers-${randomUUID()}@angoleva.ao`;
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
  await db.insert(schema.crmCompanies).values({ id, name: "Empresa de Teste", owner: "Sara Neto" });
  return id;
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (offerIds.length > 0) {
    await db.delete(schema.crmDiscountOffers).where(inArray(schema.crmDiscountOffers.id, offerIds));
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

test("listar propostas devolve as propostas criadas", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: companyId, percent: 5, scope: "Categorias habituais", valid_days: 15 },
  });
  offerIds.push(create.json().data.id);

  const list = await app.inject({ method: "GET", url: "/crm/offers", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(Array.isArray(list.json().data));
});

test("criar uma proposta herda o gestor do cliente e começa Por apresentar", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: companyId, percent: 7, scope: "Toda a encomenda", valid_days: 10 },
  });
  assert.equal(create.statusCode, 201);
  offerIds.push(create.json().data.id);
  assert.equal(create.json().data.status, "Por apresentar");
  assert.equal(create.json().data.owner, "Sara Neto");
  assert.equal(create.json().data.origin, "Proposta manual");
});

test("criar uma segunda proposta substitui a proposta aberta anterior", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const first = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: companyId, percent: 5, scope: "Categorias habituais", valid_days: 15 },
  });
  const firstId = first.json().data.id as string;
  offerIds.push(firstId);

  const second = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: companyId, percent: 8, scope: "Toda a encomenda", valid_days: 20 },
  });
  const secondId = second.json().data.id as string;
  offerIds.push(secondId);

  const [firstRow] = await db.select().from(schema.crmDiscountOffers).where(inArray(schema.crmDiscountOffers.id, [firstId]));
  assert.equal(firstRow.status, "Substituída");
});

test("aceitar a proposta altera o estado para Apresentada", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: companyId, percent: 5, scope: "Categorias habituais", valid_days: 15 },
  });
  const id = create.json().data.id as string;
  offerIds.push(id);

  const present = await app.inject({
    method: "PATCH",
    url: `/crm/offers/${id}/status`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Apresentada" },
  });
  assert.equal(present.statusCode, 200);
  assert.equal(present.json().data.status, "Apresentada");
});

test("criar uma proposta com desconto acima do limite é rejeitado por regra de negócio", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: companyId, percent: 45, scope: "Categorias habituais", valid_days: 15 },
  });
  assert.equal(create.statusCode, 422);
  assert.equal(create.json().error.code, "validation");
});

test("criar uma proposta para um cliente inexistente falha com not_found", async () => {
  const session = await auth();

  const create = await app.inject({
    method: "POST",
    url: "/crm/offers",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { company_id: "nao-existe", percent: 5, scope: "Categorias habituais", valid_days: 15 },
  });
  assert.equal(create.statusCode, 404);
  assert.equal(create.json().error.code, "not_found");
});
