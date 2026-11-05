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
const contactIds: string[] = [];
const companyIds: string[] = [];

async function insertAdminAccount() {
  const id = newId("acc");
  const email = `teste-crm-contacts-${randomUUID()}@angoleva.ao`;
  await db.insert(schema.accounts).values({ id, kind: "admin", email, fullName: "Gestora de Teste", active: true, adminRole: "admin", passwordHash: null });
  accountIds.push(id);
  return { id, email };
}

async function auth() {
  const admin = await insertAdminAccount();
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

function contactId(tag: string) {
  const id = `contacto-teste-${tag}-${randomUUID().slice(0, 8)}`;
  contactIds.push(id);
  return id;
}

const CONSENT = {
  email: { granted: true, date: "2026-10-01", origin: "Formulário" },
  sms: { granted: false, date: "2026-10-01", origin: "Formulário" },
  whatsapp: { granted: true, date: "2026-10-01", origin: "Formulário" },
};

function createPayload(id: string, companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Fernanda Quitumba",
    role: "Gerente",
    company_id: companyId,
    company_name: "Empresa de Teste",
    phone: "+244 921 334 221",
    whatsapp: "+244 921 334 221",
    email: "fernanda@mail.co.ao",
    consent: CONSENT,
    ...overrides,
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (contactIds.length > 0) {
    await db.delete(schema.crmContacts).where(inArray(schema.crmContacts.id, contactIds));
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

test("criar e obter um contacto", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const id = contactId("criar");

  const create = await app.inject({
    method: "POST",
    url: "/crm/contacts",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(id, companyId),
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().data.name, "Fernanda Quitumba");
  assert.equal(create.json().data.contactability, "Válido");

  const get = await app.inject({ method: "GET", url: `/crm/contacts/${id}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.company_id, companyId);
});

test("obter um contacto inexistente falha com not_found", async () => {
  const session = await auth();
  const response = await app.inject({ method: "GET", url: "/crm/contacts/nao-existe", cookies: { admin_session: session.cookieValue } });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
});

test("alterar o estado de contactabilidade", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const id = contactId("estado");

  await app.inject({ method: "POST", url: "/crm/contacts", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(id, companyId) });

  const response = await app.inject({
    method: "PATCH",
    url: `/crm/contacts/${id}/contactability`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Saiu da empresa" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.contactability, "Saiu da empresa");
});

test("alternar consentimento inverte o estado do canal", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const id = contactId("consentimento");

  await app.inject({ method: "POST", url: "/crm/contacts", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(id, companyId) });

  const response = await app.inject({
    method: "POST",
    url: `/crm/contacts/${id}/consent/toggle`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { channel: "sms" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.consent.sms.granted, true);
  assert.equal(response.json().data.consent.email.granted, true);
});

test("fundir dois contactos remove o secundário e aplica as escolhas de campo", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const primaryId = contactId("fundir-primario");
  const secondaryId = contactId("fundir-secundario");

  await app.inject({ method: "POST", url: "/crm/contacts", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(primaryId, companyId, { phone: "+244 900 000 001" }) });
  await app.inject({ method: "POST", url: "/crm/contacts", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(secondaryId, companyId, { phone: "+244 900 000 002", role: "Proprietário" }) });

  const merge = await app.inject({
    method: "POST",
    url: "/crm/contacts/merge",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: {
      primary_id: primaryId,
      secondary_id: secondaryId,
      choices: { role: "secondary", phone: "secondary", whatsapp: "primary", email: "primary" },
    },
  });
  assert.equal(merge.statusCode, 200);
  assert.equal(merge.json().data.merged.role, "Proprietário");
  assert.equal(merge.json().data.merged.phone, "+244 900 000 002");
  assert.equal(merge.json().data.removed_id, secondaryId);

  const secondaryGone = await app.inject({ method: "GET", url: `/crm/contacts/${secondaryId}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(secondaryGone.statusCode, 404);
});

test("anonimizar um contacto apaga os dados pessoais e revoga o consentimento", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const id = contactId("anonimizar");

  await app.inject({ method: "POST", url: "/crm/contacts", cookies: { admin_session: session.cookieValue }, headers: { "x-csrf-token": session.csrfToken }, payload: createPayload(id, companyId) });

  const response = await app.inject({
    method: "POST",
    url: `/crm/contacts/${id}/anonymize`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, "Contacto anonimizado");
  assert.equal(response.json().data.contactability, "Pediu remoção");
  assert.equal(response.json().data.consent.email.granted, false);
  assert.equal(response.json().data.phone, "");
});
