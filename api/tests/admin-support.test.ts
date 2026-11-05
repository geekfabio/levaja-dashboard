import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const userAccountIds: string[] = [];
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
    await db.delete(schema.reviewNotes).where(inArray(schema.reviewNotes.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (userAccountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, userAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...userAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

async function createRequest(clientId: string) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status: "rated",
    clientAccountId: clientId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    dropoff: placeFixture("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [],
    pickupPhotos: [],
    paymentMethod: "cash",
    rating: 1,
    review: "O prestador chegou com muito atraso.",
  });
  requestIds.push(id);
  return { id, code };
}

async function createTicket(clientId: string, priority: "low" | "medium" | "high" | "urgent" = "urgent", createdAt?: Date) {
  const id = newId("tkt");
  await db.insert(schema.supportTickets).values({
    id,
    code: `TK-${Math.floor(Math.random() * 90000)}`,
    accountId: clientId,
    reason: "atraso",
    description: "O pedido demorou muito mais do que o previsto.",
    subject: "Atraso na recolha",
    priority,
    createdAt: createdAt ?? new Date(),
  });
  ticketIds.push(id);
  return id;
}

test("suporte: lista, atribui, responde e resolve uma ocorrência (e aplica as regras de estado)", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("support-ticket");
  userAccountIds.push(client.id);
  const ticketId = await createTicket(client.id, "urgent");

  const list = await app.inject({ method: "GET", url: "/admin/support/tickets", cookies: supportSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === ticketId));

  const assign = await app.inject({
    method: "POST",
    url: `/admin/support/tickets/${ticketId}/assign`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { assignee_id: supportAdmin.id },
  });
  assert.equal(assign.statusCode, 200);
  assert.equal(assign.json().data.status, "in_progress");
  assert.equal(assign.json().data.assignee_id, supportAdmin.id);

  const reassignSame = await app.inject({
    method: "POST",
    url: `/admin/support/tickets/${ticketId}/assign`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { assignee_id: supportAdmin.id },
  });
  assert.equal(reassignSame.statusCode, 422);
  assert.equal(reassignSame.json().error.code, "validation");

  const reply = await app.inject({
    method: "POST",
    url: `/admin/support/tickets/${ticketId}/reply`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { body: "Já estamos a analisar a situação, obrigado pelo contacto." },
  });
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.json().data.messages.length, 1);

  const resolve = await app.inject({
    method: "POST",
    url: `/admin/support/tickets/${ticketId}/resolve`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { resolution: "Prestador foi advertido e cliente foi compensado." },
  });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.json().data.status, "resolved");

  const resolveAgain = await app.inject({
    method: "POST",
    url: `/admin/support/tickets/${ticketId}/resolve`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { resolution: "Segunda tentativa." },
  });
  assert.equal(resolveAgain.statusCode, 409);
  assert.equal(resolveAgain.json().error.code, "invalid_transition");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [ticketId]));
  assert.deepEqual(
    auditRows.map((row) => row.action).sort(),
    ["ticket.assign", "ticket.reply", "ticket.resolve"],
  );
});

test("finanças não geram acesso a ocorrências de suporte (forbidden)", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const forbidden = await app.inject({ method: "GET", url: "/admin/support/tickets", cookies: financeSession.cookies });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");
});

test("suporte: calcula o prazo de resposta (SLA) por prioridade", async () => {
  const supportAdmin = await insertAdminAccount("support", "support-sla");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("support-sla");
  userAccountIds.push(client.id);

  const breachedCreatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const urgentBreachedId = await createTicket(client.id, "urgent", breachedCreatedAt);
  const lowFreshId = await createTicket(client.id, "low", new Date());

  const summary = await app.inject({ method: "GET", url: "/admin/support/response-summary", cookies: supportSession.cookies });
  assert.equal(summary.statusCode, 200);
  assert.ok(summary.json().data.breached >= 1);

  const ticketBreached = await app.inject({ method: "GET", url: `/admin/support/tickets/${urgentBreachedId}`, cookies: supportSession.cookies });
  assert.equal(ticketBreached.statusCode, 200);
  assert.equal(ticketBreached.json().data.status, "open");

  const ticketFresh = await app.inject({ method: "GET", url: `/admin/support/tickets/${lowFreshId}`, cookies: supportSession.cookies });
  assert.equal(ticketFresh.statusCode, 200);
});

test("suporte: acompanha e resolve um alerta SOS", async () => {
  const supportAdmin = await insertAdminAccount("support", "support-sos");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("support-sos");
  userAccountIds.push(client.id);
  const { id: requestId } = await createRequest(client.id);

  const sosId = newId("sos");
  await db.insert(schema.sosAlerts).values({
    id: sosId,
    requestId,
    accountId: client.id,
    lat: "-8.8256",
    lng: "13.2311",
    area: "Maianga",
    message: "Fui assaltado durante a entrega.",
  });
  sosIds.push(sosId);

  const list = await app.inject({ method: "GET", url: "/admin/support/sos?status=open", cookies: supportSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === sosId));

  const acknowledge = await app.inject({
    method: "POST",
    url: `/admin/support/sos/${sosId}/acknowledge`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
  });
  assert.equal(acknowledge.statusCode, 200);
  assert.equal(acknowledge.json().data.status, "acknowledged");

  const acknowledgeAgain = await app.inject({
    method: "POST",
    url: `/admin/support/sos/${sosId}/acknowledge`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
  });
  assert.equal(acknowledgeAgain.statusCode, 409);
  assert.equal(acknowledgeAgain.json().error.code, "invalid_transition");

  const resolve = await app.inject({
    method: "POST",
    url: `/admin/support/sos/${sosId}/resolve`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { resolution: "Cliente está em segurança, polícia contactada." },
  });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.json().data.status, "resolved");
});

test("suporte: trata uma avaliação baixa", async () => {
  const supportAdmin = await insertAdminAccount("support", "support-reviews");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("support-reviews");
  userAccountIds.push(client.id);
  const { id: requestId } = await createRequest(client.id);
  const reviewId = `rv-${requestId}`;

  const list = await app.inject({ method: "GET", url: "/admin/support/low-ratings?handled=false", cookies: supportSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === reviewId));

  const handle = await app.inject({
    method: "POST",
    url: `/admin/support/low-ratings/${reviewId}/handle`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { note: "Falámos com o prestador e com o cliente." },
  });
  assert.equal(handle.statusCode, 200);
  assert.equal(handle.json().data.handled, true);

  const handleAgain = await app.inject({
    method: "POST",
    url: `/admin/support/low-ratings/${reviewId}/handle`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { note: "Segunda tentativa." },
  });
  assert.equal(handleAgain.statusCode, 409);
  assert.equal(handleAgain.json().error.code, "invalid_transition");
});
