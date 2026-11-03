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
const campaignIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-campaigns-${randomUUID()}@angoleva.ao`;
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

async function createCampaign(session: Awaited<ReturnType<typeof auth>>, overrides: Record<string, unknown> = {}) {
  const create = await app.inject({
    method: "POST",
    url: "/crm/campaigns",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { channel: "Email", template_id: "promocao-semanal", ...overrides },
  });
  const id = create.json().data.id as string;
  campaignIds.push(id);
  return { response: create, id };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (campaignIds.length > 0) {
    await db.delete(schema.crmCampaigns).where(inArray(schema.crmCampaigns.id, campaignIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("listar campanhas devolve as campanhas criadas", async () => {
  const session = await auth();
  await createCampaign(session);

  const list = await app.inject({ method: "GET", url: "/crm/campaigns", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(Array.isArray(list.json().data));
});

test("criar a partir de um modelo começa em Rascunho", async () => {
  const session = await auth();
  const { response } = await createCampaign(session, { channel: "SMS", template_id: "sms-promocao" });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.status, "Rascunho");
  assert.equal(response.json().data.channel, "SMS");
});

test("fluxo completo: submeter, testar e agendar", async () => {
  const session = await auth();
  const { id } = await createCampaign(session);

  const submit = await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/submit-for-review`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(submit.statusCode, 200);
  assert.equal(submit.json().data.status, "Em revisão");

  const test_ = await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/record-test`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(test_.statusCode, 200);
  assert.ok(test_.json().data.test_sent_at);

  const schedule = await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/schedule`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { scheduled_at: "2026-11-10T09:00:00.000Z", recipients: 120 },
  });
  assert.equal(schedule.statusCode, 200);
  assert.equal(schedule.json().data.status, "Agendada");
  assert.equal(schedule.json().data.recipients, 120);

  const cancel = await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/cancel-schedule`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(cancel.statusCode, 200);
  assert.equal(cancel.json().data.status, "Em revisão");
});

test("agendar sem enviar teste é rejeitado como transição inválida", async () => {
  const session = await auth();
  const { id } = await createCampaign(session);

  await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/submit-for-review`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });

  const schedule = await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/schedule`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { scheduled_at: "2026-11-10T09:00:00.000Z", recipients: 50 },
  });
  assert.equal(schedule.statusCode, 409);
  assert.equal(schedule.json().error.code, "invalid_transition");
});

test("submeter uma campanha já em revisão é rejeitado como transição inválida", async () => {
  const session = await auth();
  const { id } = await createCampaign(session);

  await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/submit-for-review`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });

  const second = await app.inject({
    method: "POST",
    url: `/crm/campaigns/${id}/submit-for-review`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error.code, "invalid_transition");
});
