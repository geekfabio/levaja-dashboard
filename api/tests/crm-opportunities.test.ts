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
const opportunityIds: string[] = [];
const companyIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-opportunities-${randomUUID()}@angoleva.ao`;
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

function createPayload(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyId,
    company_name: "Empresa de Teste",
    contact_name: "Fernanda Quitumba",
    value_kz: 18_500_000,
    stage: "Qualificação",
    probability: 30,
    owner: "Sara Neto",
    products: ["Mercearia", "Bebidas"],
    ...overrides,
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (opportunityIds.length > 0) {
    await db.delete(schema.crmOpportunities).where(inArray(schema.crmOpportunities.id, opportunityIds));
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

test("criar uma oportunidade regista o histórico de fase inicial", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/opportunities",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(companyId),
  });
  assert.equal(create.statusCode, 201);
  const body = create.json().data;
  opportunityIds.push(body.id);

  assert.equal(body.stage, "Qualificação");
  assert.equal(body.value_kz, 18_500_000);
  assert.equal(body.stage_history.length, 1);
  assert.equal(body.stage_history[0].stage, "Qualificação");
});

test("criar uma oportunidade sem contacto falha com validation", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const response = await app.inject({
    method: "POST",
    url: "/crm/opportunities",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(companyId, { contact_name: "   " }),
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "validation");
});

test("mover de fase acrescenta ao histórico e ajusta a probabilidade ao ganhar", async () => {
  const session = await auth("Mariana Capitão");
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/opportunities",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(companyId),
  });
  const id = create.json().data.id;
  opportunityIds.push(id);

  const toProposal = await app.inject({
    method: "POST",
    url: `/crm/opportunities/${id}/stage`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { stage: "Proposta" },
  });
  assert.equal(toProposal.statusCode, 200);
  assert.equal(toProposal.json().data.stage_history.length, 2);

  const won = await app.inject({
    method: "POST",
    url: `/crm/opportunities/${id}/stage`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { stage: "Fechada - Ganha" },
  });
  assert.equal(won.statusCode, 200);
  assert.equal(won.json().data.probability, 100);
  assert.equal(won.json().data.stage_history.length, 3);
  assert.equal(won.json().data.stage_history[2].author, "Mariana Capitão");
});

test("mover para Fechada - Perdida sem motivo falha com validation", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const create = await app.inject({
    method: "POST",
    url: "/crm/opportunities",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(companyId),
  });
  const id = create.json().data.id;
  opportunityIds.push(id);

  const lost = await app.inject({
    method: "POST",
    url: `/crm/opportunities/${id}/stage`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { stage: "Fechada - Perdida" },
  });
  assert.equal(lost.statusCode, 422);
  assert.equal(lost.json().error.code, "validation");

  const lostWithReason = await app.inject({
    method: "POST",
    url: `/crm/opportunities/${id}/stage`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { stage: "Fechada - Perdida", loss_reason: "Preço" },
  });
  assert.equal(lostWithReason.statusCode, 200);
  assert.equal(lostWithReason.json().data.probability, 0);
  assert.equal(lostWithReason.json().data.loss_reason, "Preço");
});

test("obter uma oportunidade inexistente falha com not_found", async () => {
  const session = await auth();
  const response = await app.inject({ method: "GET", url: "/crm/opportunities/nao-existe", cookies: { admin_session: session.cookieValue } });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
});
