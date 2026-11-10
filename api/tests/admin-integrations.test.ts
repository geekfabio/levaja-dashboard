import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const apiKeyIds: string[] = [];
const webhookIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (webhookIds.length > 0) {
    await db.delete(schema.adminWebhookDeliveries).where(inArray(schema.adminWebhookDeliveries.webhookId, webhookIds));
    await db.delete(schema.adminWebhooks).where(inArray(schema.adminWebhooks.id, webhookIds));
  }
  if (apiKeyIds.length > 0) {
    await db.delete(schema.adminApiKeys).where(inArray(schema.adminApiKeys.id, apiKeyIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

test("lê chaves de API e devolve o segredo só na criação; suporte não pode gerir integrações (forbidden)", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const forbidden = await app.inject({ method: "GET", url: "/admin/integrations/keys", cookies: supportSession.cookies });
  assert.equal(forbidden.statusCode, 403);

  const missingScope = await app.inject({
    method: "POST",
    url: "/admin/integrations/keys",
    cookies: session.cookies,
    headers: session.headers,
    payload: { name: "Integração de teste", scopes: [], expires_in_days: 30 },
  });
  assert.equal(missingScope.statusCode, 422);

  const create = await app.inject({
    method: "POST",
    url: "/admin/integrations/keys",
    cookies: session.cookies,
    headers: session.headers,
    payload: { name: "Integração de teste", scopes: ["requests.read"], expires_in_days: 30 },
  });
  assert.equal(create.statusCode, 200);
  const created = create.json().data;
  assert.ok(created.secret.startsWith("lj_live_"));
  assert.equal(created.item.name, "Integração de teste");
  apiKeyIds.push(created.item.id);

  const list = await app.inject({ method: "GET", url: "/admin/integrations/keys", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  const listed = list.json().data.find((item: { id: string }) => item.id === created.item.id);
  assert.ok(listed);
  assert.equal(listed.secret, undefined);
});

test("revoga uma chave com motivo e fica auditado; repetir falha (invalid_transition)", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const create = await app.inject({
    method: "POST",
    url: "/admin/integrations/keys",
    cookies: session.cookies,
    headers: session.headers,
    payload: { name: "Chave a revogar", scopes: ["providers.read"], expires_in_days: null },
  });
  const keyId = create.json().data.item.id;
  apiKeyIds.push(keyId);

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/integrations/keys/${keyId}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(noReason.statusCode, 422);

  const revoke = await app.inject({
    method: "POST",
    url: `/admin/integrations/keys/${keyId}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Chave comprometida." },
  });
  assert.equal(revoke.statusCode, 200);
  assert.ok(revoke.json().data.revoked_at);

  const revokeAgain = await app.inject({
    method: "POST",
    url: `/admin/integrations/keys/${keyId}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetir." },
  });
  assert.equal(revokeAgain.statusCode, 409);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [keyId]));
  assert.ok(auditRows.some((row) => row.action === "integration.key_revoke"));
});

test("cria webhook, rejeita endereço interno, testa a entrega simulada e desactiva", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const invalidUrl = await app.inject({
    method: "POST",
    url: "/admin/integrations/webhooks",
    cookies: session.cookies,
    headers: session.headers,
    payload: { url: "http://localhost:3000/hook", description: "Teste", events: ["request.created"] },
  });
  assert.equal(invalidUrl.statusCode, 422);

  const create = await app.inject({
    method: "POST",
    url: "/admin/integrations/webhooks",
    cookies: session.cookies,
    headers: session.headers,
    payload: { url: "https://example.com/hooks/angoleva", description: "Webhook de teste", events: ["request.created", "payment.paid"] },
  });
  assert.equal(create.statusCode, 200);
  const created = create.json().data;
  assert.ok(created.secret.startsWith("whsec_"));
  webhookIds.push(created.item.id);

  const duplicate = await app.inject({
    method: "POST",
    url: "/admin/integrations/webhooks",
    cookies: session.cookies,
    headers: session.headers,
    payload: { url: "https://example.com/hooks/angoleva", description: "Repetido", events: ["request.created"] },
  });
  assert.equal(duplicate.statusCode, 422);

  const test1 = await app.inject({
    method: "POST",
    url: `/admin/integrations/webhooks/${created.item.id}/test`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(test1.statusCode, 200);
  assert.equal(test1.json().data.simulated, true);

  const deactivate = await app.inject({
    method: "POST",
    url: `/admin/integrations/webhooks/${created.item.id}/active`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { active: false },
  });
  assert.equal(deactivate.statusCode, 200);
  assert.equal(deactivate.json().data.active, false);

  const testWhileInactive = await app.inject({
    method: "POST",
    url: `/admin/integrations/webhooks/${created.item.id}/test`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(testWhileInactive.statusCode, 409);

  const list = await app.inject({ method: "GET", url: "/admin/integrations/webhooks", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  const listed = list.json().data.find((item: { id: string }) => item.id === created.item.id);
  assert.equal(listed.deliveries.length, 1);
});
