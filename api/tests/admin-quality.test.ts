import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const userAccountIds: string[] = [];
const requestIds: string[] = [];
const penaltyIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (penaltyIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.id, penaltyIds.map((id) => `tx-${id}`)));
    await db.delete(schema.penalties).where(inArray(schema.penalties.id, penaltyIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (userAccountIds.length > 0) {
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

async function createCancelledRequest(clientId: string, providerId: string) {
  const id = newId("req");
  await db.insert(schema.serviceRequests).values({
    id,
    code: `AL-${Math.floor(Math.random() * 90000) + 10000}`,
    serviceType: "tow",
    status: "cancelled",
    clientAccountId: clientId,
    providerAccountId: providerId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    stops: [],
    photos: [],
    pickupPhotos: [],
  });
  requestIds.push(id);
  return id;
}

test("lista pontuações de qualidade e sinaliza cancelamentos acima do limite", async () => {
  const admin = await insertAdminAccount("operations", "quality-list");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("quality-client");
  userAccountIds.push(client.id);
  const provider = await insertProviderAccount("quality-provider");
  userAccountIds.push(provider.id);

  for (let i = 0; i < 4; i += 1) {
    await createCancelledRequest(client.id, provider.id);
  }

  const scores = await app.inject({ method: "GET", url: "/admin/quality", cookies: session.cookies });
  assert.equal(scores.statusCode, 200);
  const entry = scores.json().data.find((item: { provider_id: string }) => item.provider_id === provider.id);
  assert.ok(entry, "esperava encontrar o prestador na lista de qualidade");
  assert.ok(entry.flags.includes("cancellations"));
  assert.equal(entry.cancelled, 4);

  const flagged = await app.inject({ method: "GET", url: "/admin/quality?flag=cancellations", cookies: session.cookies });
  assert.ok(flagged.json().data.some((item: { provider_id: string }) => item.provider_id === provider.id));

  const detail = await app.inject({ method: "GET", url: `/admin/quality/${provider.id}`, cookies: session.cookies });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.cancelled, 4);
});

test("aplica multa, afecta a carteira e anula a penalização", async () => {
  const admin = await insertAdminAccount("operations", "quality-fine");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const provider = await insertProviderAccount("quality-fine-provider");
  userAccountIds.push(provider.id);
  await db.insert(schema.wallets).values({ providerAccountId: provider.id, balanceKz: 10000 });

  const noReason = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/penalties`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { kind: "fine", reason: "", amount_kz: 5000 },
  });
  assert.equal(noReason.statusCode, 422);

  const fine = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/penalties`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { kind: "fine", reason: "Chegou com quase uma hora de atraso.", amount_kz: 5000 },
  });
  assert.equal(fine.statusCode, 200);
  const penalty = fine.json().data;
  penaltyIds.push(penalty.id);
  assert.equal(penalty.amount_kz, 5000);

  const [walletAfterFine] = await db.select().from(schema.wallets).where(inArray(schema.wallets.providerAccountId, [provider.id]));
  assert.equal(walletAfterFine?.balanceKz, 5000);

  const penalties = await app.inject({ method: "GET", url: `/admin/penalties?provider_id=${provider.id}`, cookies: session.cookies });
  assert.equal(penalties.statusCode, 200);
  assert.ok(penalties.json().data.some((item: { id: string }) => item.id === penalty.id));

  const revokeNoReason = await app.inject({
    method: "POST",
    url: `/admin/penalties/${penalty.id}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(revokeNoReason.statusCode, 422);

  const revoke = await app.inject({
    method: "POST",
    url: `/admin/penalties/${penalty.id}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Reconsiderado após recurso do prestador." },
  });
  assert.equal(revoke.statusCode, 200);
  assert.ok(revoke.json().data.revoked_at);

  const [walletAfterRevoke] = await db.select().from(schema.wallets).where(inArray(schema.wallets.providerAccountId, [provider.id]));
  assert.equal(walletAfterRevoke?.balanceKz, 10000);

  const revokeAgain = await app.inject({
    method: "POST",
    url: `/admin/penalties/${penalty.id}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetir anulação." },
  });
  assert.equal(revokeAgain.statusCode, 409);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [penalty.id]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["penalty.issue", "penalty.revoke"]);
});

test("suspende um prestador por penalização e bloqueia suspensão duplicada", async () => {
  const admin = await insertAdminAccount("operations", "quality-suspend");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const provider = await insertProviderAccount("quality-suspend-provider");
  userAccountIds.push(provider.id);

  const suspend = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/penalties`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { kind: "suspension", reason: "Reincidência em cancelamentos.", days: 5 },
  });
  assert.equal(suspend.statusCode, 200);
  const penalty = suspend.json().data;
  penaltyIds.push(penalty.id);

  const [providerRow] = await db.select().from(schema.providers).where(inArray(schema.providers.accountId, [provider.id]));
  assert.equal(providerRow?.accountStatus, "suspended");

  const doubleSuspend = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/penalties`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { kind: "suspension", reason: "Segunda suspensão.", days: 2 },
  });
  assert.equal(doubleSuspend.statusCode, 409);

  const revoke = await app.inject({
    method: "POST",
    url: `/admin/penalties/${penalty.id}/revoke`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Suspensão anulada por engano." },
  });
  assert.equal(revoke.statusCode, 200);

  const [providerAfterRevoke] = await db.select().from(schema.providers).where(inArray(schema.providers.accountId, [provider.id]));
  assert.equal(providerAfterRevoke?.accountStatus, "active");
});

test("suporte não pode penalizar prestadores (forbidden)", async () => {
  const supportAdmin = await insertAdminAccount("support", "quality-support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const provider = await insertProviderAccount("quality-support-provider");
  userAccountIds.push(provider.id);

  const forbidden = await app.inject({
    method: "POST",
    url: `/admin/providers/${provider.id}/penalties`,
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { kind: "warning", reason: "A testar permissões." },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");
});
