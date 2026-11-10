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
const contactIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (contactIds.length > 0) {
    await db.delete(schema.emergencyContacts).where(inArray(schema.emergencyContacts.id, contactIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

test("admin cria, actualiza e remove um contacto de emergência; aparece na listagem", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const create = await app.inject({
    method: "POST",
    url: "/admin/support/emergency-contacts",
    cookies: session.cookies,
    headers: session.headers,
    payload: { label: "Contacto de teste", phone_number: "900000000", reason: "Teste" },
  });
  assert.equal(create.statusCode, 200);
  const created = create.json().data;
  contactIds.push(created.id);
  assert.equal(created.label, "Contacto de teste");
  assert.equal(created.phone_number, "900000000");

  const list = await app.inject({ method: "GET", url: "/admin/support/emergency-contacts", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === created.id));

  const update = await app.inject({
    method: "PATCH",
    url: `/admin/support/emergency-contacts/${created.id}`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { label: "Contacto actualizado", phone_number: "911111111", reason: "Correcção" },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.label, "Contacto actualizado");

  const remove = await app.inject({
    method: "DELETE",
    url: `/admin/support/emergency-contacts/${created.id}`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Teste concluído" },
  });
  assert.equal(remove.statusCode, 200);

  const listAfter = await app.inject({ method: "GET", url: "/admin/support/emergency-contacts", cookies: session.cookies });
  assert.ok(!listAfter.json().data.some((item: { id: string }) => item.id === created.id));
});

test("mutação sem motivo falha com validation", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const res = await app.inject({
    method: "POST",
    url: "/admin/support/emergency-contacts",
    cookies: session.cookies,
    headers: session.headers,
    payload: { label: "Sem motivo", phone_number: "900000001" },
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error.code, "validation");
});

test("papel sem permissão de suporte não consegue gerir contactos", async () => {
  const admin = await insertAdminAccount("finance");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const res = await app.inject({
    method: "POST",
    url: "/admin/support/emergency-contacts",
    cookies: session.cookies,
    headers: session.headers,
    payload: { label: "Sem permissão", phone_number: "900000002", reason: "Teste" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error.code, "forbidden");
});

test("sem autenticação devolve unauthorized", async () => {
  const res = await app.inject({ method: "GET", url: "/admin/support/emergency-contacts" });
  assert.equal(res.statusCode, 401);
});

test("remover contacto inexistente devolve not_found", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const res = await app.inject({
    method: "DELETE",
    url: "/admin/support/emergency-contacts/emc-inexistente",
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Teste" },
  });
  assert.equal(res.statusCode, 404);
});
