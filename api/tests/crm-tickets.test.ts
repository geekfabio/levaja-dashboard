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
const ticketIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-tickets-${randomUUID()}@angoleva.ao`;
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

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Entrega incompleta",
    description: "Faltaram 3 caixas de óleo na entrega de ontem.",
    priority: "Alta",
    origin: "Manual",
    assignee: "Sara Neto",
    assignee_avatar: "/assets/images/_common/avatars/avatar-1.png",
    ...overrides,
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (ticketIds.length > 0) {
    await db.delete(schema.crmTickets).where(inArray(schema.crmTickets.id, ticketIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("criar um ticket manual regista a linha do tempo com o autor", async () => {
  const session = await auth("Sara Neto");

  const create = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(),
  });
  assert.equal(create.statusCode, 201);
  const body = create.json().data;
  ticketIds.push(body.id);

  assert.equal(body.status, "Aberto");
  assert.equal(body.timeline.length, 1);
  assert.equal(body.timeline[0].label, "Ticket criado");
  assert.equal(body.timeline[0].author, "Sara Neto");
});

test("criar um ticket vindo de e-mail atribui o contacto como autor da criação", async () => {
  const session = await auth();

  const create = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload({ origin: "E-mail", contact_name: "Fernanda Quitumba" }),
  });
  assert.equal(create.statusCode, 201);
  const body = create.json().data;
  ticketIds.push(body.id);
  assert.equal(body.timeline[0].label, "Ticket criado a partir de e-mail");
  assert.equal(body.timeline[0].author, "Fernanda Quitumba");
});

test("criar um ticket sem assunto falha com validation", async () => {
  const session = await auth();
  const response = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload({ subject: "   " }),
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "validation");
});

test("adicionar um comentário regista a primeira resposta uma única vez", async () => {
  const session = await auth();

  const create = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(),
  });
  const id = create.json().data.id;
  ticketIds.push(id);

  const firstComment = await app.inject({
    method: "POST",
    url: `/crm/tickets/${id}/comments`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { body: "A reposição sai amanhã." },
  });
  assert.equal(firstComment.statusCode, 200);
  assert.ok(firstComment.json().data.first_response_at);
  const firstResponseAt = firstComment.json().data.first_response_at;
  assert.equal(firstComment.json().data.timeline.at(-1).label, "Primeira resposta enviada");

  const secondComment = await app.inject({
    method: "POST",
    url: `/crm/tickets/${id}/comments`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { body: "Entrega confirmada para as 9h." },
  });
  assert.equal(secondComment.statusCode, 200);
  assert.equal(secondComment.json().data.first_response_at, firstResponseAt);
  assert.equal(secondComment.json().data.comments.length, 2);
  assert.equal(secondComment.json().data.timeline.at(-1).label, "Comentário adicionado");
});

test("comentário vazio falha com validation", async () => {
  const session = await auth();
  const create = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(),
  });
  const id = create.json().data.id;
  ticketIds.push(id);

  const response = await app.inject({
    method: "POST",
    url: `/crm/tickets/${id}/comments`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { body: "   " },
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "validation");
});

test("alterar o estado para Resolvido regista a data de resolução", async () => {
  const session = await auth();
  const create = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(),
  });
  const id = create.json().data.id;
  ticketIds.push(id);

  const response = await app.inject({
    method: "PATCH",
    url: `/crm/tickets/${id}/status`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { status: "Resolvido" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "Resolvido");
  assert.ok(response.json().data.resolved_at);
  assert.equal(response.json().data.timeline.at(-1).label, "Estado alterado para Resolvido");
});

test("atribuir o ticket a outra pessoa regista a linha do tempo", async () => {
  const session = await auth();
  const create = await app.inject({
    method: "POST",
    url: "/crm/tickets",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: createPayload(),
  });
  const id = create.json().data.id;
  ticketIds.push(id);

  const response = await app.inject({
    method: "PATCH",
    url: `/crm/tickets/${id}/assignee`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { assignee: "Jaime Teixeira", assignee_avatar: "/assets/images/_common/avatars/avatar-2.png" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.assignee, "Jaime Teixeira");
  assert.equal(response.json().data.timeline.at(-1).label, "Atribuído a Jaime Teixeira");
});

test("obter um ticket inexistente falha com not_found", async () => {
  const session = await auth();
  const response = await app.inject({ method: "GET", url: "/crm/tickets/nao-existe", cookies: { admin_session: session.cookieValue } });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
});
