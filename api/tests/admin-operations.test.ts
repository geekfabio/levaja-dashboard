import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const providerAccountIds: string[] = [];
const requestIds: string[] = [];
const zoneIds: string[] = [];

const ZONE_CENTER = { lat: -9.55, lng: 13.75 };
const PICKUP = placeFixture("plc-ops-origin", -9.551, 13.751);
const HEATMAP_CENTER = { lat: -9.58, lng: 13.78 };
const HEATMAP_PICKUP = placeFixture("plc-ops-heatmap", -9.581, 13.781);

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (zoneIds.length > 0) {
    await db.delete(schema.zones).where(inArray(schema.zones.id, zoneIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, providerAccountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  }
  if (clientAccountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...clientAccountIds, ...providerAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

async function createRequest(options: {
  clientId: string;
  providerId?: string | null;
  status: "searching" | "assigned" | "delivered";
  scheduledFor?: Date | null;
  createdAt?: Date;
  pickup?: ReturnType<typeof placeFixture>;
}) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status: options.status,
    clientAccountId: options.clientId,
    providerAccountId: options.providerId ?? null,
    pickup: options.pickup ?? PICKUP,
    dropoff: null,
    stops: [],
    scheduledFor: options.scheduledFor ?? null,
    photos: [],
    pickupPhotos: [],
    createdAt: options.createdAt ?? new Date(),
  });
  requestIds.push(id);
  return id;
}

test("agendados: calcula risco, atribuição e totais; filtra por estado e zona", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("ops-scheduled");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("ops-scheduled");
  providerAccountIds.push(provider.id);

  const zoneId = newId("zn");
  zoneIds.push(zoneId);
  await db.insert(schema.zones).values({ id: zoneId, name: "Zona Operações Teste", lat: ZONE_CENTER.lat.toString(), lng: ZONE_CENTER.lng.toString(), radiusKm: "2" });

  const now = Date.now();
  const riskRequest = await createRequest({ clientId: client.id, status: "searching", scheduledFor: new Date(now + 60 * 60_000) });
  const assignedRequest = await createRequest({ clientId: client.id, providerId: provider.id, status: "assigned", scheduledFor: new Date(now + 5 * 3_600_000) });
  await createRequest({ clientId: client.id, status: "searching", scheduledFor: new Date(now + 40 * 24 * 3_600_000) });

  const all = await app.inject({ method: "GET", url: "/admin/operations/scheduled?days=14", cookies: session.cookies });
  assert.equal(all.statusCode, 200);
  const allData = all.json().data;
  const ids = allData.items.map((item: { id: string }) => item.id);
  assert.ok(ids.includes(riskRequest));
  assert.ok(ids.includes(assignedRequest));
  assert.ok(allData.totals.risk >= 1);
  assert.ok(allData.totals.unassigned >= 1);

  const riskOnly = await app.inject({ method: "GET", url: "/admin/operations/scheduled?state=risk&days=14", cookies: session.cookies });
  const riskIds = riskOnly.json().data.items.map((item: { id: string }) => item.id);
  assert.ok(riskIds.includes(riskRequest));
  assert.ok(!riskIds.includes(assignedRequest));

  const assignedOnly = await app.inject({ method: "GET", url: "/admin/operations/scheduled?state=assigned&days=14", cookies: session.cookies });
  const assignedIds = assignedOnly.json().data.items.map((item: { id: string }) => item.id);
  assert.ok(assignedIds.includes(assignedRequest));
  assert.ok(!assignedIds.includes(riskRequest));

  const byZone = await app.inject({ method: "GET", url: `/admin/operations/scheduled?zone=${zoneId}&days=14`, cookies: session.cookies });
  const byZoneIds = byZone.json().data.items.map((item: { id: string }) => item.id);
  assert.ok(byZoneIds.includes(riskRequest));

  const item = allData.items.find((entry: { id: string }) => entry.id === riskRequest);
  assert.equal(item.zone_name, "Zona Operações Teste");
  assert.equal(item.risk, true);
});

test("SLA: calcula estatísticas de atribuição e chegada contra as metas, com desvios ordenados", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("ops-sla");
  clientAccountIds.push(client.id);

  const withinTarget = await createRequest({ clientId: client.id, status: "assigned", createdAt: new Date("2026-01-10T08:00:00Z") });
  const breachingTarget = await createRequest({ clientId: client.id, status: "assigned", createdAt: new Date("2026-01-10T09:00:00Z") });

  await db.insert(schema.serviceRequestEvents).values([
    { id: newId("evt"), requestId: withinTarget, status: "assigned", actor: "provider", at: new Date("2026-01-10T08:05:00Z") },
    { id: newId("evt"), requestId: breachingTarget, status: "assigned", actor: "provider", at: new Date("2026-01-10T09:25:00Z") },
  ]);

  const response = await app.inject({ method: "GET", url: "/admin/operations/sla?from=2026-01-10&to=2026-01-10", cookies: session.cookies });
  assert.equal(response.statusCode, 200);
  const data = response.json().data;
  assert.equal(data.targets.assign, 8);
  assert.ok(data.assign.count >= 2);
  assert.ok(data.breaches.some((breach: { request_id: string; metric: string }) => breach.request_id === breachingTarget && breach.metric === "assign"));
  assert.ok(!data.breaches.some((breach: { request_id: string }) => breach.request_id === withinTarget));
  assert.ok(Array.isArray(data.daily));
  assert.ok(data.daily.some((day: { date: string }) => day.date === "2026-01-10"));
});

test("mapa de calor: agrega procura e oferta por zona com proporção", async () => {
  const admin = await insertAdminAccount("operations");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("ops-heatmap");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("ops-heatmap", { online: true, accountStatus: "active" });
  providerAccountIds.push(provider.id);

  const zoneId = newId("zn");
  zoneIds.push(zoneId);
  await db.insert(schema.zones).values({ id: zoneId, name: "Zona Mapa de Calor", lat: HEATMAP_CENTER.lat.toString(), lng: HEATMAP_CENTER.lng.toString(), radiusKm: "2" });
  await db.update(schema.providers).set({ lat: HEATMAP_CENTER.lat.toString(), lng: HEATMAP_CENTER.lng.toString(), coverageZoneIds: [zoneId] }).where(eq(schema.providers.accountId, provider.id));

  await createRequest({ clientId: client.id, status: "searching", createdAt: new Date(), pickup: HEATMAP_PICKUP });

  const demand = await app.inject({ method: "GET", url: "/admin/operations/heatmap?kind=demand&days=7", cookies: session.cookies });
  assert.equal(demand.statusCode, 200);
  const demandData = demand.json().data;
  assert.ok(demandData.points.length >= 1);
  const demandZone = demandData.zones.find((zone: { zone_id: string }) => zone.zone_id === zoneId);
  assert.ok(demandZone);
  assert.ok(demandZone.demand >= 1);

  const supply = await app.inject({ method: "GET", url: "/admin/operations/heatmap?kind=supply&days=7", cookies: session.cookies });
  assert.equal(supply.statusCode, 200);
  const supplyZone = supply.json().data.zones.find((zone: { zone_id: string }) => zone.zone_id === zoneId);
  assert.ok(supplyZone);
  assert.equal(supplyZone.supply, 1);
  assert.equal(supplyZone.ratio, 1);
});
