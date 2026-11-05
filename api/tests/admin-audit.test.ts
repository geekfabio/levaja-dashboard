import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const auditIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (auditIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.id, auditIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

test("audit.view lista e filtra; um papel sem audit.view é rejeitado com forbidden", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const entryId = newId("aud");
  auditIds.push(entryId);
  await db.insert(schema.adminAuditLog).values({
    id: entryId,
    actorAccountId: admin.id,
    action: "zone.create",
    targetModule: "zone",
    targetId: "zn_fixture_test",
    targetLabel: "Zona Fixture Teste",
    reason: "Criação para teste de auditoria.",
    changes: [],
    sensitive: true,
  });

  const forbidden = await app.inject({ method: "GET", url: "/admin/audit", cookies: opsSession.cookies });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const list = await app.inject({ method: "GET", url: "/admin/audit", cookies: session.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === entryId));

  const filteredByAction = await app.inject({ method: "GET", url: "/admin/audit?action=zone.create", cookies: session.cookies });
  assert.equal(filteredByAction.statusCode, 200);
  assert.ok(filteredByAction.json().data.every((item: { action: string }) => item.action === "zone.create"));

  const filteredByQuery = await app.inject({ method: "GET", url: "/admin/audit?q=Fixture", cookies: session.cookies });
  assert.equal(filteredByQuery.statusCode, 200);
  assert.ok(filteredByQuery.json().data.some((item: { id: string }) => item.id === entryId));

  const filteredOut = await app.inject({ method: "GET", url: "/admin/audit?action=pricing.update&q=Fixture", cookies: session.cookies });
  assert.equal(filteredOut.statusCode, 200);
  assert.ok(!filteredOut.json().data.some((item: { id: string }) => item.id === entryId));
});
