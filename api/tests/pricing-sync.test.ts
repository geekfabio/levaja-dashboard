import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount, insertClientAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const accountIds: string[] = [];
const adminAccountIds: string[] = [];
const requestIds: string[] = [];

const PICKUP = placeFixture("plc-maianga", -8.8256, 13.2311);
const DROPOFF = placeFixture("plc-talatona", -8.9167, 13.1833);

function requestBody(clientId: string) {
  return {
    service_type: "tow",
    client_id: clientId,
    pickup: PICKUP,
    dropoff: DROPOFF,
    stops: [],
    scheduled_for: null,
    tow_details: { incident: "mechanical", brand: "Toyota", model: "Corolla", plate: "LD-01-01-AA", color: "Branco", can_move: true },
    cargo_details: null,
    moving_details: null,
    photos: [],
    instructions: null,
    payment_method: "cash",
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (requestIds.length > 0) await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, "pricing"));
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  if (accountIds.length > 0) await db.delete(schema.clients).where(inArray(schema.clients.accountId, accountIds));
  await db.delete(schema.accounts).where(inArray(schema.accounts.id, [...accountIds, ...adminAccountIds]));
  await app.close();
});

test("alterar o preço base no painel muda de facto o preço de um pedido novo", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);
  const client = await insertClientAccount("pricing-sync");
  accountIds.push(client.id);

  const before = await app.inject({ method: "POST", url: "/requests", headers: { authorization: `Bearer ${client.token}` }, payload: requestBody(client.id) });
  assert.equal(before.statusCode, 201);
  const baseline = before.json().data;
  requestIds.push(baseline.id);
  assert.equal(baseline.pricing.base_kz, 8000);

  const update = await app.inject({
    method: "PUT",
    url: "/admin/pricing",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      rules: [
        { kind: "tow", base: 50000, per_km: 250 },
        { kind: "cargo", base: 5500, per_km: 250 },
        { kind: "small_move", base: 9000, per_km: 300 },
        { kind: "house_move", base: 18000, per_km: 400 },
      ],
      extras: [],
      platform_fee: 500,
      commission_rate: 0.15,
      round_to: 500,
      reason: "Teste de sincronização de preços",
    },
  });
  assert.equal(update.statusCode, 200);

  const after = await app.inject({ method: "POST", url: "/requests", headers: { authorization: `Bearer ${client.token}` }, payload: requestBody(client.id) });
  assert.equal(after.statusCode, 201);
  const updated = after.json().data;
  requestIds.push(updated.id);
  assert.equal(updated.pricing.base_kz, 50000);
});
