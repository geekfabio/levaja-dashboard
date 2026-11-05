import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, placeFixture } from "./helpers/admin";
import { signAccessToken } from "../src/lib/jwt";

let app: FastifyInstance;

const accountIds: string[] = [];
const adminAccountIds: string[] = [];
const requestIds: string[] = [];
const ticketIds: string[] = [];
const sosIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (ticketIds.length > 0) {
    await db.delete(schema.supportTicketMessages).where(inArray(schema.supportTicketMessages.ticketId, ticketIds));
    await db.delete(schema.supportTickets).where(inArray(schema.supportTickets.id, ticketIds));
  }
  if (sosIds.length > 0) {
    await db.delete(schema.sosAlerts).where(inArray(schema.sosAlerts.id, sosIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, accountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, accountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...accountIds, ...adminAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

function testEmail(tag: string) {
  return `teste-suporte-movel-${tag}-${randomUUID()}@angoleva.ao`;
}

async function createClient(tag: string) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "client", email, phone: "+244 923 000 000", fullName: `Cliente ${tag}`, active: true });
  await db.insert(schema.clients).values({ accountId: id });
  accountIds.push(id);
  const { token } = await signAccessToken({ sub: id, kind: "client", email });
  return { id, token };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createRequest(clientId: string) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status: "searching",
    clientAccountId: clientId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    dropoff: placeFixture("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [],
    pickupPhotos: [],
  });
  requestIds.push(id);
  return { id, code };
}

test("ajuda: lista artigos e filtra por categoria e por texto", async () => {
  const all = await app.inject({ method: "GET", url: "/help" });
  assert.equal(all.statusCode, 200);
  assert.ok(all.json().data.length > 0);

  const byCategory = await app.inject({ method: "GET", url: "/help?category=safety" });
  assert.equal(byCategory.statusCode, 200);
  assert.ok(byCategory.json().data.length > 0);
  assert.ok(byCategory.json().data.every((item: { category: string }) => item.category === "safety"));

  const byText = await app.inject({ method: "GET", url: `/help?q=${encodeURIComponent("cancelar")}` });
  assert.equal(byText.statusCode, 200);
  assert.ok(byText.json().data.some((item: { question: string }) => item.question.toLowerCase().includes("cancelar")));

  const noMatch = await app.inject({ method: "GET", url: `/help?q=${encodeURIComponent("xyznadaaquimesmo")}` });
  assert.equal(noMatch.statusCode, 200);
  assert.deepEqual(noMatch.json().data, []);
});

test("ajuda: contactos de emergência devolve o que estiver na tabela (hoje, vazio)", async () => {
  const response = await app.inject({ method: "GET", url: "/help/emergency-contacts" });
  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().data));
});

test("ocorrências: criar uma ocorrência gera um código único e aparece no painel", async () => {
  const client = await createClient("tickets");
  const { id: requestId } = await createRequest(client.id);

  const noAuth = await app.inject({ method: "POST", url: "/tickets", payload: { request_id: requestId, reason: "atraso", description: "O prestador demorou muito a chegar." } });
  assert.equal(noAuth.statusCode, 401);

  const created = await app.inject({
    method: "POST",
    url: "/tickets",
    headers: auth(client.token),
    payload: { request_id: requestId, reason: "atraso", description: "O prestador demorou muito a chegar." },
  });
  assert.equal(created.statusCode, 201);
  const code = created.json().data.code as string;
  assert.match(code, /^TK-\d{5}$/);

  const createdAgain = await app.inject({
    method: "POST",
    url: "/tickets",
    headers: auth(client.token),
    payload: { request_id: requestId, reason: "atraso", description: "Segunda ocorrência, outro motivo." },
  });
  assert.equal(createdAgain.statusCode, 201);
  assert.notEqual(createdAgain.json().data.code, code);

  const supportAdmin = await insertAdminAccount("support", "support-mobile-tickets");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const panel = await app.inject({ method: "GET", url: "/admin/support/tickets", cookies: supportSession.cookies });
  assert.equal(panel.statusCode, 200);
  const panelCodes = panel.json().data.map((item: { code: string }) => item.code);
  assert.ok(panelCodes.includes(code));

  const rows = await db.select().from(schema.supportTickets).where(inArray(schema.supportTickets.requestId, [requestId]));
  rows.forEach((row) => ticketIds.push(row.id));
});

test("ocorrências: validação da descrição e do pedido", async () => {
  const client = await createClient("tickets-validation");
  const other = await createClient("tickets-other-owner");
  const { id: otherRequestId } = await createRequest(other.id);

  const tooShort = await app.inject({
    method: "POST",
    url: "/tickets",
    headers: auth(client.token),
    payload: { request_id: otherRequestId, reason: "atraso", description: "curto" },
  });
  assert.equal(tooShort.statusCode, 422);

  const notOwned = await app.inject({
    method: "POST",
    url: "/tickets",
    headers: auth(client.token),
    payload: { request_id: otherRequestId, reason: "atraso", description: "Isto não é o meu pedido, mas tentei abrir uma ocorrência." },
  });
  assert.equal(notOwned.statusCode, 403);

  const notFound = await app.inject({
    method: "POST",
    url: "/tickets",
    headers: auth(client.token),
    payload: { request_id: "req_inexistente", reason: "atraso", description: "Um pedido que não existe de todo." },
  });
  assert.equal(notFound.statusCode, 404);
});

test("SOS: criar um alerta aparece no painel e é rejeitado sem pedido próprio ou sem autenticação", async () => {
  const client = await createClient("sos");
  const { id: requestId } = await createRequest(client.id);

  const noAuth = await app.inject({ method: "POST", url: "/sos", payload: { request_id: requestId, lat: -8.8256, lng: 13.2311 } });
  assert.equal(noAuth.statusCode, 401);

  const created = await app.inject({
    method: "POST",
    url: "/sos",
    headers: auth(client.token),
    payload: { request_id: requestId, lat: -8.8256, lng: 13.2311 },
  });
  assert.equal(created.statusCode, 204);

  const withoutRequest = await app.inject({
    method: "POST",
    url: "/sos",
    headers: auth(client.token),
    payload: { request_id: null, lat: -8.8256, lng: 13.2311 },
  });
  assert.equal(withoutRequest.statusCode, 204);

  const other = await createClient("sos-other-owner");
  const notOwned = await app.inject({
    method: "POST",
    url: "/sos",
    headers: auth(other.token),
    payload: { request_id: requestId, lat: -8.8256, lng: 13.2311 },
  });
  assert.equal(notOwned.statusCode, 403);

  const supportAdmin = await insertAdminAccount("support", "support-mobile-sos");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const panel = await app.inject({ method: "GET", url: "/admin/support/sos", cookies: supportSession.cookies });
  assert.equal(panel.statusCode, 200);
  const panelRequestIds = panel.json().data.map((item: { request_id: string | null }) => item.request_id);
  assert.ok(panelRequestIds.includes(requestId));

  const rows = await db.select().from(schema.sosAlerts).where(inArray(schema.sosAlerts.accountId, [client.id]));
  rows.forEach((row) => sosIds.push(row.id));
});
