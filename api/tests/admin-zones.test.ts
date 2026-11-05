import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount, insertProviderAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const providerAccountIds: string[] = [];
const zoneIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (zoneIds.length > 0) {
    await db.delete(schema.zones).where(inArray(schema.zones.id, zoneIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...providerAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

// Coordenadas afastadas dos pontos fixos usados noutros ficheiros de teste
// (Maianga/Talatona), para que pedidos activos criados noutros testes, numa
// base de dados partilhada entre ficheiros, não interfiram na contagem de
// "pedidos activos na zona".
function zoneBody(name: string, overrides: Record<string, unknown> = {}) {
  return { name, latitude: -9.5, longitude: 13.75, radius_km: 1, reason: "Criação de teste.", ...overrides };
}

test("suporte não pode criar zonas (forbidden); zonas.edit cria, actualiza e remove com auditoria", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const forbidden = await app.inject({
    method: "POST",
    url: "/admin/zones",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: zoneBody("Zona de teste suporte"),
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const create = await app.inject({
    method: "POST",
    url: "/admin/zones",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: zoneBody("Zona Maianga Teste"),
  });
  assert.equal(create.statusCode, 200);
  const zoneId = create.json().data.id;
  zoneIds.push(zoneId);

  const invalidCoords = await app.inject({
    method: "POST",
    url: "/admin/zones",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: zoneBody("Zona Fora de Luanda", { latitude: 10, longitude: 10 }),
  });
  assert.equal(invalidCoords.statusCode, 422);
  assert.equal(invalidCoords.json().error.code, "validation");

  const duplicate = await app.inject({
    method: "POST",
    url: "/admin/zones",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: zoneBody("Zona Maianga Teste"),
  });
  assert.equal(duplicate.statusCode, 422);

  const list = await app.inject({ method: "GET", url: "/admin/zones", cookies: opsSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === zoneId));

  const update = await app.inject({
    method: "PATCH",
    url: `/admin/zones/${zoneId}`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: zoneBody("Zona Maianga Renomeada", { reason: "Correcção do nome." }),
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.name, "Zona Maianga Renomeada");

  const noChanges = await app.inject({
    method: "PATCH",
    url: `/admin/zones/${zoneId}`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: zoneBody("Zona Maianga Renomeada", { reason: "Sem alterações." }),
  });
  assert.equal(noChanges.statusCode, 422);

  const provider = await insertProviderAccount("zone-remove");
  providerAccountIds.push(provider.id);
  await db.update(schema.providers).set({ coverageZoneIds: [zoneId] }).where(eq(schema.providers.accountId, provider.id));

  const removeBlocked = await app.inject({
    method: "DELETE",
    url: `/admin/zones/${zoneId}`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "A tentar remover." },
  });
  assert.equal(removeBlocked.statusCode, 422);

  await db.update(schema.providers).set({ coverageZoneIds: [] }).where(eq(schema.providers.accountId, provider.id));

  const remove = await app.inject({
    method: "DELETE",
    url: `/admin/zones/${zoneId}`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Já não é necessária." },
  });
  assert.equal(remove.statusCode, 200);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [zoneId]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["zone.create", "zone.delete", "zone.update"]);
});
