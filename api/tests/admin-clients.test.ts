import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount, insertClientAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const clientAccountIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (clientAccountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...clientAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

test("lista e lê clientes", async () => {
  const admin = await insertAdminAccount("support");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("list");
  clientAccountIds.push(client.id);

  const list = await app.inject({ method: "GET", url: "/admin/clients", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === client.id));

  const get = await app.inject({ method: "GET", url: `/admin/clients/${client.id}`, cookies: session.cookies });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.blocked, false);
});

test("finanças não pode bloquear clientes (forbidden); suporte bloqueia com motivo e fica auditado", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("block");
  clientAccountIds.push(client.id);

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/clients/${client.id}/block`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { reason: "Finanças a tentar bloquear." },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/clients/${client.id}/block`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: {},
  });
  assert.equal(noReason.statusCode, 422);

  const block = await app.inject({
    method: "POST",
    url: `/admin/clients/${client.id}/block`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Pagamentos em disputa." },
  });
  assert.equal(block.statusCode, 200);
  assert.equal(block.json().data.blocked, true);
  assert.equal(block.json().data.blocked_reason, "Pagamentos em disputa.");

  const blockAgain = await app.inject({
    method: "POST",
    url: `/admin/clients/${client.id}/block`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Repetir." },
  });
  assert.equal(blockAgain.statusCode, 409);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [client.id]));
  assert.ok(auditRows.some((row) => row.action === "client.block"));

  const unblock = await app.inject({
    method: "POST",
    url: `/admin/clients/${client.id}/unblock`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Pagamento regularizado." },
  });
  assert.equal(unblock.statusCode, 200);
  assert.equal(unblock.json().data.blocked, false);
});

test("devolve pedidos, avaliações e tickets do cliente", async () => {
  const admin = await insertAdminAccount("support");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("detail");
  clientAccountIds.push(client.id);

  const requests = await app.inject({ method: "GET", url: `/admin/clients/${client.id}/requests`, cookies: session.cookies });
  assert.equal(requests.statusCode, 200);
  assert.deepEqual(requests.json().data, []);

  const reviews = await app.inject({ method: "GET", url: `/admin/clients/${client.id}/reviews`, cookies: session.cookies });
  assert.equal(reviews.statusCode, 200);
  assert.deepEqual(reviews.json().data, []);

  const tickets = await app.inject({ method: "GET", url: `/admin/clients/${client.id}/tickets`, cookies: session.cookies });
  assert.equal(tickets.statusCode, 200);
  assert.deepEqual(tickets.json().data, []);
});
