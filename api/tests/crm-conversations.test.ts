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
const conversationIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-conversations-${randomUUID()}@angoleva.ao`;
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

const GRANTED = { granted: true, date: "2026-10-01", origin: "Formulário" };
const REVOKED = { granted: false, date: "2026-10-01", origin: "Formulário" };

async function createContact(companyId: string, overrides: Record<string, unknown> = {}) {
  const id = `contacto-teste-${randomUUID().slice(0, 8)}`;
  contactIds.push(id);
  await db.insert(schema.crmContacts).values({
    id,
    companyId,
    name: "Fernanda Quitumba",
    companyName: "Empresa de Teste",
    phone: "+244 921 334 221",
    whatsapp: "+244 921 334 221",
    contactability: "Válido",
    consent: { email: GRANTED, sms: GRANTED, whatsapp: GRANTED },
    ...overrides,
  });
  return id;
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (conversationIds.length > 0) {
    await db.delete(schema.crmConversationMessages).where(inArray(schema.crmConversationMessages.conversationId, conversationIds));
    await db.delete(schema.crmConversations).where(inArray(schema.crmConversations.id, conversationIds));
  }
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

test("iniciar uma conversa e listar as existentes", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const contactId = await createContact(companyId);

  const start = await app.inject({
    method: "POST",
    url: "/crm/conversations",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { contact_id: contactId, channel: "WhatsApp" },
  });
  assert.equal(start.statusCode, 201);
  conversationIds.push(start.json().data.id);
  assert.equal(start.json().data.contact_id, contactId);
  assert.equal(start.json().data.messages.length, 0);

  const list = await app.inject({ method: "GET", url: "/crm/conversations", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === start.json().data.id));
});

test("responder a uma conversa com consentimento concedido envia a mensagem simulada", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const contactId = await createContact(companyId);

  const start = await app.inject({
    method: "POST",
    url: "/crm/conversations",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { contact_id: contactId, channel: "WhatsApp" },
  });
  const conversationId = start.json().data.id;
  conversationIds.push(conversationId);

  const reply = await app.inject({
    method: "POST",
    url: `/crm/conversations/${conversationId}/reply`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { body: "Bom dia, a sua encomenda já saiu do armazém." },
  });
  assert.equal(reply.statusCode, 200);
  const last = reply.json().data.messages.at(-1);
  assert.equal(last.direction, "out");
  assert.equal(last.status, "Simulado");
});

test("responder a uma conversa sem consentimento bloqueia o envio", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const contactId = await createContact(companyId, { consent: { email: GRANTED, sms: GRANTED, whatsapp: REVOKED } });

  const start = await app.inject({
    method: "POST",
    url: "/crm/conversations",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { contact_id: contactId, channel: "WhatsApp" },
  });
  const conversationId = start.json().data.id;
  conversationIds.push(conversationId);

  const reply = await app.inject({
    method: "POST",
    url: `/crm/conversations/${conversationId}/reply`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { body: "Boa tarde!" },
  });
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.json().data.messages.at(-1).status, "Bloqueado");
});

test("receber PARAR revoga o consentimento do canal automaticamente", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const contactId = await createContact(companyId);

  const receive = await app.inject({
    method: "POST",
    url: "/crm/conversations/receive",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { contact_id: contactId, channel: "WhatsApp", body: "PARAR" },
  });
  assert.equal(receive.statusCode, 200);
  conversationIds.push(receive.json().data.conversation.id);
  assert.equal(receive.json().data.opted_out, true);
  assert.equal(receive.json().data.conversation.messages.length, 2);
  assert.equal(receive.json().data.conversation.messages[1].direction, "system");

  const [contact] = await db.select().from(schema.crmContacts).where(inArray(schema.crmContacts.id, [contactId]));
  const consent = contact!.consent as Record<string, { granted: boolean }>;
  assert.equal(consent.whatsapp!.granted, false);
});

test("marcar como lida zera as mensagens não lidas", async () => {
  const session = await auth();
  const companyId = await createCompany();
  const contactId = await createContact(companyId);

  const receive = await app.inject({
    method: "POST",
    url: "/crm/conversations/receive",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { contact_id: contactId, channel: "WhatsApp", body: "Bom dia, ainda têm arroz?" },
  });
  const conversationId = receive.json().data.conversation.id;
  conversationIds.push(conversationId);
  assert.equal(receive.json().data.conversation.unread, 1);

  const read = await app.inject({
    method: "PATCH",
    url: `/crm/conversations/${conversationId}/read`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(read.statusCode, 204);

  const get = await app.inject({ method: "GET", url: `/crm/conversations/${conversationId}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(get.json().data.unread, 0);
});
