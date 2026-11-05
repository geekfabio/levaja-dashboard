import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const requestIds: string[] = [];
const zoneIds: string[] = [];
const broadcastIds: string[] = [];

function zoneFixture(tag: string, lat: number, lng: number) {
  return { name: `Zona de teste comunicações (${tag})`, lat: lat.toFixed(4), lng: lng.toFixed(4), radiusKm: "1.0" };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (broadcastIds.length > 0) {
    await db.delete(schema.broadcasts).where(inArray(schema.broadcasts.id, broadcastIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (zoneIds.length > 0) {
    await db.delete(schema.zones).where(inArray(schema.zones.id, zoneIds));
  }
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

async function createZone(tag: string, lat: number, lng: number) {
  const id = newId("zn");
  const zone = zoneFixture(tag, lat, lng);
  await db.insert(schema.zones).values({ id, name: zone.name, lat: zone.lat, lng: zone.lng, radiusKm: zone.radiusKm });
  zoneIds.push(id);
  return id;
}

async function createRequestInZone(clientId: string, lat: number, lng: number) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  const pickup = placeFixture("plc-comms", lat, lng);
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status: "delivered",
    clientAccountId: clientId,
    pickup,
    dropoff: pickup,
    stops: [],
    photos: [],
    pickupPhotos: [],
    paymentMethod: "cash",
  });
  requestIds.push(id);
  return id;
}

test("estima o público por zona e cria, agenda e cancela uma comunicação; suporte não pode gerir comunicações (forbidden)", async () => {
  const opsAdmin = await insertAdminAccount("operations");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const outsider = await insertAdminAccount("finance");
  adminAccountIds.push(outsider.id);
  const outsiderSession = await createAdminSession(app, outsider.id);

  const zoneId = await createZone("fluxo", -8.95, 13.45);
  const client = await insertClientAccount("comms-flow");
  clientAccountIds.push(client.id);
  await createRequestInZone(client.id, -8.95, 13.45);

  const forbidden = await app.inject({ method: "GET", url: "/admin/communications", cookies: outsiderSession.cookies });
  assert.equal(forbidden.statusCode, 403);

  const estimate = await app.inject({
    method: "POST",
    url: "/admin/communications/estimate",
    cookies: opsSession.cookies,
    payload: { audience: { kind: "clients", segment: "all", zone_ids: [zoneId] } },
  });
  assert.equal(estimate.statusCode, 200);
  assert.equal(estimate.json().data.recipients, 1);
  assert.deepEqual(estimate.json().data.sample, ["Cliente comms-flow"]);

  const invalidMessage = await app.inject({
    method: "POST",
    url: "/admin/communications",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: {
      title: "Campanha de teste",
      channel: "sms",
      audience: { kind: "clients", segment: "all", zone_ids: [zoneId] },
      message: "curta",
    },
  });
  assert.equal(invalidMessage.statusCode, 422);

  const create = await app.inject({
    method: "POST",
    url: "/admin/communications",
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: {
      title: "Campanha de teste",
      channel: "sms",
      audience: { kind: "clients", segment: "all", zone_ids: [zoneId] },
      message: "Mensagem de teste com mais de dez caracteres.",
    },
  });
  assert.equal(create.statusCode, 200);
  const broadcast = create.json().data;
  assert.equal(broadcast.status, "draft");
  broadcastIds.push(broadcast.id);

  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const pastSchedule = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/schedule`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { at: new Date(Date.now() - 1000).toISOString() },
  });
  assert.equal(pastSchedule.statusCode, 422);

  const schedule = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/schedule`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { at: future },
  });
  assert.equal(schedule.statusCode, 200);
  assert.equal(schedule.json().data.status, "scheduled");

  const cancelNoReason = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: {},
  });
  assert.equal(cancelNoReason.statusCode, 422);

  const cancel = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Já não é necessário." },
  });
  assert.equal(cancel.statusCode, 200);
  assert.equal(cancel.json().data.status, "cancelled");

  const cancelAgain = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/cancel`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Repetir." },
  });
  assert.equal(cancelAgain.statusCode, 409);

  const list = await app.inject({ method: "GET", url: "/admin/communications?status=cancelled", cookies: opsSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === broadcast.id));

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [broadcast.id]));
  assert.ok(auditRows.some((row) => row.action === "broadcast.create"));
  assert.ok(auditRows.some((row) => row.action === "broadcast.schedule"));
  assert.ok(auditRows.some((row) => row.action === "broadcast.cancel"));
});

test("envia uma comunicação por email, regista destinatários e rejeita público sem destinatários", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const zoneId = await createZone("envio", -9.05, 13.55);
  const client = await insertClientAccount("comms-send");
  clientAccountIds.push(client.id);
  await createRequestInZone(client.id, -9.05, 13.55);

  const create = await app.inject({
    method: "POST",
    url: "/admin/communications",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      title: "Envio de teste",
      channel: "email",
      subject: "Assunto de teste",
      audience: { kind: "clients", segment: "all", zone_ids: [zoneId] },
      message: "Mensagem de teste com mais de dez caracteres.",
    },
  });
  assert.equal(create.statusCode, 200);
  const broadcast = create.json().data;
  broadcastIds.push(broadcast.id);

  const send = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/send`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(send.statusCode, 200);
  assert.equal(send.json().data.status, "sent");
  assert.equal(send.json().data.recipients, 1);

  const sendAgain = await app.inject({
    method: "POST",
    url: `/admin/communications/${broadcast.id}/send`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(sendAgain.statusCode, 409);

  const emptyAudienceZone = await createZone("vazia", -9.15, 13.65);
  const createEmpty = await app.inject({
    method: "POST",
    url: "/admin/communications",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      title: "Sem destinatários",
      channel: "push",
      audience: { kind: "clients", segment: "all", zone_ids: [emptyAudienceZone] },
      message: "Mensagem sem destinatários nesta zona.",
    },
  });
  const emptyBroadcast = createEmpty.json().data;
  broadcastIds.push(emptyBroadcast.id);

  const sendEmpty = await app.inject({
    method: "POST",
    url: `/admin/communications/${emptyBroadcast.id}/send`,
    cookies: session.cookies,
    headers: session.headers,
  });
  assert.equal(sendEmpty.statusCode, 422);
});
