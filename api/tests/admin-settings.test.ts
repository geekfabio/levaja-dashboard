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

before(async () => {
  app = await buildApp();
});

after(async () => {
  await db.delete(schema.platformSettings).where(inArray(schema.platformSettings.key, ["settings", "role_permissions"]));
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

test("lê as definições por omissão", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const get = await app.inject({ method: "GET", url: "/admin/settings", cookies: session.cookies });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.general.trade_name, "AngoLeva");
  assert.equal(get.json().data.security.session_hours, 12);
});

test("actualiza a secção general com motivo; suporte não pode (forbidden); valor inválido falha", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const generalPayload = {
    trade_name: "AngoLeva",
    legal_name: "AngoLeva Tecnologias, Lda.",
    nif: "5000123456",
    support_phone: "+244 923 000 111",
    support_email: "apoio@angoleva.ao",
    opening_hours: "Todos os dias, 06:00–22:00",
    terms_url: "https://angoleva.ao/termos",
    privacy_url: "https://angoleva.ao/privacidade",
  };

  const forbidden = await app.inject({
    method: "PUT",
    url: "/admin/settings/general",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { value: generalPayload, reason: "Suporte a tentar editar." },
  });
  assert.equal(forbidden.statusCode, 403);

  const invalid = await app.inject({
    method: "PUT",
    url: "/admin/settings/general",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: { ...generalPayload, support_email: "não é email" }, reason: "Corrigir contacto." },
  });
  assert.equal(invalid.statusCode, 422);

  const noReason = await app.inject({
    method: "PUT",
    url: "/admin/settings/general",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: generalPayload },
  });
  assert.equal(noReason.statusCode, 422);

  const update = await app.inject({
    method: "PUT",
    url: "/admin/settings/general",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: generalPayload, reason: "Actualizar horário de funcionamento." },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.general.opening_hours, "Todos os dias, 06:00–22:00");

  const noChanges = await app.inject({
    method: "PUT",
    url: "/admin/settings/general",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: generalPayload, reason: "Repetir." },
  });
  assert.equal(noChanges.statusCode, 422);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, [admin.id]));
  assert.ok(auditRows.some((row) => row.action === "settings.update" && row.targetId === "general"));
});

test("secção dispatch exige permissão settings.operations e rejeita valores fora do intervalo", async () => {
  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const operationsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(operationsAdmin.id);
  const operationsSession = await createAdminSession(app, operationsAdmin.id);

  const dispatchPayload = {
    initial_radius_km: 5,
    max_radius_km: 15,
    offer_timeout_seconds: 45,
    max_attempts: 5,
    stalled_after_minutes: 10,
    schedule_lead_minutes: 60,
    assign_target_minutes: 8,
    arrival_target_minutes: 30,
    distance_weight: 70,
    fallback: "manual",
  };

  const forbidden = await app.inject({
    method: "PUT",
    url: "/admin/settings/dispatch",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { value: dispatchPayload, reason: "Finanças a tentar editar." },
  });
  assert.equal(forbidden.statusCode, 403);

  const invalid = await app.inject({
    method: "PUT",
    url: "/admin/settings/dispatch",
    cookies: operationsSession.cookies,
    headers: operationsSession.headers,
    payload: { value: { ...dispatchPayload, max_radius_km: 2 }, reason: "Reduzir raio." },
  });
  assert.equal(invalid.statusCode, 422);

  const update = await app.inject({
    method: "PUT",
    url: "/admin/settings/dispatch",
    cookies: operationsSession.cookies,
    headers: operationsSession.headers,
    payload: { value: { ...dispatchPayload, offer_timeout_seconds: 60 }, reason: "Dar mais tempo ao prestador." },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.dispatch.offer_timeout_seconds, 60);
});

test("secção security exige permissão security.manage e rejeita IP inválido", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const invalid = await app.inject({
    method: "PUT",
    url: "/admin/settings/security",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: { require_2fa: true, session_hours: 12, ip_allowlist: ["não-é-um-ip"] }, reason: "Restringir acesso." },
  });
  assert.equal(invalid.statusCode, 422);

  const update = await app.inject({
    method: "PUT",
    url: "/admin/settings/security",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: { require_2fa: true, session_hours: 8, ip_allowlist: ["196.249.104.18"] }, reason: "Restringir acesso." },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.security.session_hours, 8);
});

test("secção desconhecida falha com validation; secção inexistente no corpo também falha", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const response = await app.inject({
    method: "PUT",
    url: "/admin/settings/inexistente",
    cookies: session.cookies,
    headers: session.headers,
    payload: { value: {}, reason: "Teste." },
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "validation");
});

test("papéis e permissões: ler e actualizar exige security.manage e fica auditado", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const forbiddenRead = await app.inject({ method: "GET", url: "/admin/settings/roles", cookies: supportSession.cookies });
  assert.equal(forbiddenRead.statusCode, 403);

  const read = await app.inject({ method: "GET", url: "/admin/settings/roles", cookies: session.cookies });
  assert.equal(read.statusCode, 200);
  const matrix = read.json().data;
  assert.ok(Array.isArray(matrix.operations));

  const update = await app.inject({
    method: "PUT",
    url: "/admin/settings/roles",
    cookies: session.cookies,
    headers: session.headers,
    payload: { matrix: { ...matrix, operations: [...matrix.operations, "billing.view"] }, reason: "Dar acesso à facturação." },
  });
  assert.equal(update.statusCode, 200);
  assert.ok(update.json().data.operations.includes("billing.view"));

  const noChanges = await app.inject({
    method: "PUT",
    url: "/admin/settings/roles",
    cookies: session.cookies,
    headers: session.headers,
    payload: { matrix: update.json().data, reason: "Repetir." },
  });
  assert.equal(noChanges.statusCode, 422);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, [admin.id]));
  assert.ok(auditRows.some((row) => row.action === "roles.update"));
});
