import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertProviderAccount, insertClientAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const userAccountIds: string[] = [];
const requestIds: string[] = [];
const disputeIds: string[] = [];
const zoneIds: string[] = [];

const PICKUP = placeFixture("plc-maianga", -8.8256, 13.2311);

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (disputeIds.length > 0) {
    await db.delete(schema.disputes).where(inArray(schema.disputes.id, disputeIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.requestId, requestIds));
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (zoneIds.length > 0) {
    await db.delete(schema.zones).where(inArray(schema.zones.id, zoneIds));
  }
  if (userAccountIds.length > 0) {
    await db.delete(schema.providerDocuments).where(inArray(schema.providerDocuments.providerAccountId, userAccountIds));
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, userAccountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, userAccountIds));
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, userAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...userAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

async function createZone(tag: string, lat: number, lng: number, radiusKm: number) {
  const id = newId("zn");
  await db.insert(schema.zones).values({ id, name: `Zona ${tag} ${randomUUID().slice(0, 6)}`, lat: lat.toString(), lng: lng.toString(), radiusKm: radiusKm.toString() });
  zoneIds.push(id);
  return id;
}

async function verifyDocuments(providerAccountId: string) {
  for (const kind of ["license", "id", "vehicle", "insurance"] as const) {
    await db.insert(schema.providerDocuments).values({
      id: newId("doc"),
      providerAccountId,
      title: kind,
      kind,
      status: "verified",
      validUntil: null,
    });
  }
}

async function setProviderProfile(
  accountId: string,
  options: { zoneIds?: string[]; services?: string[]; lat?: number; lng?: number; online?: boolean; accountStatus?: "active" | "suspended" | "pending_approval" },
) {
  await db
    .update(schema.providers)
    .set({
      coverageZoneIds: options.zoneIds ?? [],
      coverageServiceTypes: options.services ?? ["tow"],
      lat: options.lat !== undefined ? options.lat.toString() : undefined,
      lng: options.lng !== undefined ? options.lng.toString() : undefined,
      online: options.online,
      accountStatus: options.accountStatus,
    })
    .where(eq(schema.providers.accountId, accountId));
}

async function createRequestRow(options: {
  clientId: string;
  providerId: string | null;
  status: string;
  totalKz?: number;
  providerEarningKz?: number | null;
  pickup?: { lat: number; lng: number };
}) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  const totalKz = options.totalKz ?? 10000;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "tow",
    status: options.status as never,
    clientAccountId: options.clientId,
    providerAccountId: options.providerId,
    pickup: options.pickup ?? PICKUP,
    dropoff: placeFixture("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [],
    pickupPhotos: [],
    pricing: { base_kz: 8000, distance_kz: 1500, extras_kz: 0, platform_fee_kz: 500, total_kz: totalKz },
    providerEarningKz: options.providerEarningKz ?? null,
    paymentMethod: "cash",
  });
  requestIds.push(id);
  return { id, code };
}

async function openDisputeRow(requestId: string) {
  const id = newId("dp");
  await db.insert(schema.disputes).values({ id, requestId, reason: "Cliente reportou dano na carga.", category: "damage", openedAt: new Date() });
  disputeIds.push(id);
  return id;
}

test("candidatos a reatribuição: exclui o prestador actual e os ocupados, assinala os sem elegibilidade", async () => {
  const opsAdmin = await insertAdminAccount("operations", "reassign-cand");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const zoneId = await createZone("maianga", PICKUP.lat, PICKUP.lng, 10);

  const client = await insertClientAccount("reassign-cand");
  userAccountIds.push(client.id);

  const currentProvider = await insertProviderAccount("reassign-current");
  userAccountIds.push(currentProvider.id);
  await setProviderProfile(currentProvider.id, { zoneIds: [zoneId], services: ["tow"], lat: PICKUP.lat, lng: PICKUP.lng, online: true, accountStatus: "active" });
  await verifyDocuments(currentProvider.id);

  const eligibleProvider = await insertProviderAccount("reassign-eligible");
  userAccountIds.push(eligibleProvider.id);
  await setProviderProfile(eligibleProvider.id, { zoneIds: [zoneId], services: ["tow"], lat: PICKUP.lat, lng: PICKUP.lng, online: true, accountStatus: "active" });
  await verifyDocuments(eligibleProvider.id);

  const offlineProvider = await insertProviderAccount("reassign-offline");
  userAccountIds.push(offlineProvider.id);
  await setProviderProfile(offlineProvider.id, { zoneIds: [zoneId], services: ["tow"], lat: PICKUP.lat, lng: PICKUP.lng, online: false, accountStatus: "active" });

  const busyProvider = await insertProviderAccount("reassign-busy");
  userAccountIds.push(busyProvider.id);
  await setProviderProfile(busyProvider.id, { zoneIds: [zoneId], services: ["tow"], lat: PICKUP.lat, lng: PICKUP.lng, online: true, accountStatus: "active" });
  await verifyDocuments(busyProvider.id);
  await createRequestRow({ clientId: client.id, providerId: busyProvider.id, status: "en_route" });

  const otherServiceProvider = await insertProviderAccount("reassign-other-service");
  userAccountIds.push(otherServiceProvider.id);
  await setProviderProfile(otherServiceProvider.id, { zoneIds: [zoneId], services: ["cargo"], lat: PICKUP.lat, lng: PICKUP.lng, online: true, accountStatus: "active" });

  const { id: requestId } = await createRequestRow({ clientId: client.id, providerId: currentProvider.id, status: "assigned" });

  const response = await app.inject({ method: "GET", url: `/admin/requests/${requestId}/reassign-candidates`, cookies: opsSession.cookies });
  assert.equal(response.statusCode, 200);
  const items = response.json().data as { provider: { id: string }; issues: string[] }[];

  assert.ok(!items.some((item) => item.provider.id === currentProvider.id), "não deve incluir o prestador actual");
  assert.ok(!items.some((item) => item.provider.id === busyProvider.id), "não deve incluir prestador ocupado");
  assert.ok(!items.some((item) => item.provider.id === otherServiceProvider.id), "não deve incluir prestador de outro serviço");

  const eligible = items.find((item) => item.provider.id === eligibleProvider.id);
  assert.ok(eligible, "deve incluir o prestador elegível");
  assert.deepEqual(eligible!.issues, []);

  const offline = items.find((item) => item.provider.id === offlineProvider.id);
  assert.ok(offline, "deve incluir o prestador offline, com problemas assinalados");
  assert.ok(offline!.issues.includes("offline"));
});

test("reatribuir muda o prestador e regista o evento; reatribuir pedido entregue falha", async () => {
  const opsAdmin = await insertAdminAccount("operations", "reassign-do");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const zoneId = await createZone("reassign-do", PICKUP.lat, PICKUP.lng, 10);

  const client = await insertClientAccount("reassign-do");
  userAccountIds.push(client.id);

  const fromProvider = await insertProviderAccount("reassign-do-from");
  userAccountIds.push(fromProvider.id);
  await setProviderProfile(fromProvider.id, { zoneIds: [zoneId], services: ["tow"], lat: PICKUP.lat, lng: PICKUP.lng, online: true, accountStatus: "active" });

  const toProvider = await insertProviderAccount("reassign-do-to");
  userAccountIds.push(toProvider.id);
  await setProviderProfile(toProvider.id, { zoneIds: [zoneId], services: ["tow"], lat: PICKUP.lat, lng: PICKUP.lng, online: true, accountStatus: "active" });
  await verifyDocuments(toProvider.id);

  const { id: requestId } = await createRequestRow({ clientId: client.id, providerId: fromProvider.id, status: "assigned" });

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/reassign`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { provider_id: toProvider.id },
  });
  assert.equal(noReason.statusCode, 422);
  assert.equal(noReason.json().error.code, "validation");

  const sameProvider = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/reassign`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { provider_id: fromProvider.id, reason: "Tentativa com o mesmo prestador." },
  });
  assert.equal(sameProvider.statusCode, 422);
  assert.equal(sameProvider.json().error.code, "validation");

  const reassign = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/reassign`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { provider_id: toProvider.id, reason: "Prestador anterior ficou indisponível." },
  });
  assert.equal(reassign.statusCode, 200);
  assert.equal(reassign.json().data.provider_id, toProvider.id);
  assert.equal(reassign.json().data.status, "assigned");

  const events = await db.select().from(schema.serviceRequestEvents).where(eq(schema.serviceRequestEvents.requestId, requestId));
  assert.ok(events.some((event) => event.status === "assigned" && event.actor === "system"));

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [requestId]));
  assert.ok(auditRows.some((row) => row.action === "request.reassign"));

  await db.update(schema.serviceRequests).set({ status: "delivered" }).where(eq(schema.serviceRequests.id, requestId));
  const afterDelivered = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/reassign`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { provider_id: fromProvider.id, reason: "Já não devia ser possível." },
  });
  assert.equal(afterDelivered.statusCode, 409);
  assert.equal(afterDelivered.json().error.code, "invalid_transition");
});

test("abrir disputa cria a linha e aparece em admin-disputes; abrir disputa duas vezes falha", async () => {
  const opsAdmin = await insertAdminAccount("operations", "open-dispute");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("open-dispute");
  userAccountIds.push(client.id);
  const { id: requestId, code } = await createRequestRow({ clientId: client.id, providerId: null, status: "delivered" });

  const tooEarly = await createRequestRow({ clientId: client.id, providerId: null, status: "assigned" });
  const earlyAttempt = await app.inject({
    method: "POST",
    url: `/admin/requests/${tooEarly.id}/dispute`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Ainda não há recolha confirmada." },
  });
  assert.equal(earlyAttempt.statusCode, 409);
  assert.equal(earlyAttempt.json().error.code, "invalid_transition");

  const open = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/dispute`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Cliente reportou atraso excessivo.", category: "delay" },
  });
  assert.equal(open.statusCode, 200);

  const [disputeRow] = await db.select().from(schema.disputes).where(eq(schema.disputes.requestId, requestId));
  assert.ok(disputeRow);
  disputeIds.push(disputeRow!.id);
  assert.equal(disputeRow!.category, "delay");
  assert.equal(disputeRow!.openedByAccountId, opsAdmin.id);

  const list = await app.inject({ method: "GET", url: "/admin/disputes?state=open", cookies: opsSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { request: { code: string } }) => item.request.code === code));

  const reopen = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/dispute`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Tentativa de abrir outra vez." },
  });
  assert.equal(reopen.statusCode, 409);
  assert.equal(reopen.json().error.code, "invalid_transition");

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [requestId]));
  assert.ok(auditRows.some((row) => row.action === "request.dispute"));
});

test("forçar conclusão avança o pedido para «rated» e resolve a disputa; sem disputa aberta falha", async () => {
  const opsAdmin = await insertAdminAccount("operations", "force-complete");
  adminAccountIds.push(opsAdmin.id);
  const opsSession = await createAdminSession(app, opsAdmin.id);

  const client = await insertClientAccount("force-complete");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("force-complete");
  userAccountIds.push(provider.id);

  const { id: noDisputeRequestId } = await createRequestRow({ clientId: client.id, providerId: provider.id, status: "pickup_confirmed" });
  const withoutDispute = await app.inject({
    method: "POST",
    url: `/admin/requests/${noDisputeRequestId}/force-complete`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Sem disputa aberta." },
  });
  assert.equal(withoutDispute.statusCode, 409);
  assert.equal(withoutDispute.json().error.code, "invalid_transition");

  const { id: requestId } = await createRequestRow({
    clientId: client.id,
    providerId: provider.id,
    status: "pickup_confirmed",
    providerEarningKz: 7000,
  });
  const disputeId = await openDisputeRow(requestId);

  const forced = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/force-complete`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Prestador confirma entrega por telefone; cliente inacessível." },
  });
  assert.equal(forced.statusCode, 200);
  assert.equal(forced.json().data.status, "rated");

  const [disputeRow] = await db.select().from(schema.disputes).where(eq(schema.disputes.id, disputeId));
  assert.ok(disputeRow!.resolvedAt);
  assert.equal(disputeRow!.resolvedByAccountId, opsAdmin.id);
  assert.equal(disputeRow!.outcome, "no_refund");

  const earningRows = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.requestId, requestId));
  assert.ok(earningRows.some((row) => row.type === "earning" && row.amountKz === 7000));

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [requestId]));
  assert.ok(auditRows.some((row) => row.action === "request.force_complete"));

  const again = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/force-complete`,
    cookies: opsSession.cookies,
    headers: opsSession.headers,
    payload: { reason: "Já foi resolvida." },
  });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().error.code, "invalid_transition");
});

test("suporte não pode reatribuir nem forçar conclusão, mas pode abrir disputa", async () => {
  const supportAdmin = await insertAdminAccount("support", "requests-extra-perm");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const client = await insertClientAccount("requests-extra-perm");
  userAccountIds.push(client.id);
  const { id: requestId } = await createRequestRow({ clientId: client.id, providerId: null, status: "delivered" });

  const forbiddenReassign = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/reassign`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { provider_id: "whatever", reason: "Tentativa." },
  });
  assert.equal(forbiddenReassign.statusCode, 403);

  const forbiddenForce = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/force-complete`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Tentativa." },
  });
  assert.equal(forbiddenForce.statusCode, 403);

  const allowedDispute = await app.inject({
    method: "POST",
    url: `/admin/requests/${requestId}/dispute`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { reason: "Suporte recebeu reclamação do cliente." },
  });
  assert.equal(allowedDispute.statusCode, 200);
  const [disputeRow] = await db.select().from(schema.disputes).where(eq(schema.disputes.requestId, requestId));
  disputeIds.push(disputeRow!.id);
});
