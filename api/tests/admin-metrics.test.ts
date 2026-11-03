import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount, insertClientAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const requestIds: string[] = [];

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

const PICKUP = placeFixture("plc-metrics-origin", -9.3, 13.6);
const DROPOFF = placeFixture("plc-metrics-dest", -9.35, 13.65);

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (clientAccountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...clientAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

test("visão geral agrega pedidos do intervalo; sem sessão é rejeitado (unauthorized)", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("metrics");
  clientAccountIds.push(client.id);

  const create = await app.inject({
    method: "POST",
    url: "/requests",
    headers: auth(client.token),
    payload: {
      service_type: "cargo",
      client_id: client.id,
      pickup: PICKUP,
      dropoff: DROPOFF,
      stops: [],
      scheduled_for: null,
      tow_details: null,
      cargo_details: { cargo_type: "boxes", description: "Caixas", weight_range: "upto100", volume: "small", vehicle_class: "pickup", helper: false },
      moving_details: null,
      photos: [],
      instructions: null,
      payment_method: "cash",
    },
  });
  assert.equal(create.statusCode, 201);
  requestIds.push(create.json().data.id);

  const now = new Date();
  const from = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const unauthenticated = await app.inject({ method: "GET", url: `/admin/metrics?from=${from}&to=${to}` });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.json().error.code, "unauthorized");

  const overview = await app.inject({ method: "GET", url: `/admin/metrics?from=${from}&to=${to}`, cookies: session.cookies });
  assert.equal(overview.statusCode, 200);
  assert.ok(overview.json().data.kpis.requests >= 1);
  assert.ok(overview.json().data.by_service.some((item: { kind: string; count: number }) => item.kind === "cargo" && item.count >= 1));

  const badRange = await app.inject({ method: "GET", url: "/admin/metrics?from=not-a-date&to=not-a-date", cookies: session.cookies });
  assert.equal(badRange.statusCode, 422);
});
