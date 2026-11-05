import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { createAdminSession, insertAdminAccount, insertClientAccount, insertProviderAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const providerAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const withdrawalIds: string[] = [];
const batchIds: string[] = [];
const requestIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (withdrawalIds.length > 0) {
    await db.delete(schema.withdrawals).where(inArray(schema.withdrawals.id, withdrawalIds));
  }
  if (batchIds.length > 0) {
    await db.delete(schema.payoutBatches).where(inArray(schema.payoutBatches.id, batchIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.providerAccountId, providerAccountIds));
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
  const allAccounts = [...adminAccountIds, ...providerAccountIds, ...clientAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

const PLACE = { id: "plc-finance", label: "Maianga", district: "Maianga", city: "Luanda", lat: -8.83, lng: 13.24 };

async function insertSettledRequest(providerId: string, clientAccountId: string, totalKz: number, platformFeeKz: number, providerEarningKz: number) {
  const id = newId("req");
  await db.insert(schema.serviceRequests).values({
    id,
    code: `LJ-${id.slice(-6).toUpperCase()}`,
    serviceType: "tow",
    status: "paid",
    clientAccountId,
    providerAccountId: providerId,
    pickup: PLACE,
    dropoff: PLACE,
    paymentMethod: "cash",
    pricing: { base_kz: totalKz - platformFeeKz, distance_kz: 0, extras_kz: 0, platform_fee_kz: platformFeeKz, total_kz: totalKz },
    providerEarningKz,
  });
  requestIds.push(id);
  return id;
}

test("GET /admin/finance/revenue agrega taxas e comissões do intervalo; sem permissão é rejeitado", async () => {
  const supportAdmin = await insertAdminAccount("support", "finance-support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const financeAdmin = await insertAdminAccount("finance", "finance-reader");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const client = await insertClientAccount("finance-revenue");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("finance-revenue", { accountStatus: "active" });
  providerAccountIds.push(provider.id);

  await insertSettledRequest(provider.id, client.id, 8500, 500, 6800);

  const forbidden = await app.inject({ method: "GET", url: "/admin/finance/revenue?from=2020-01-01&to=2030-01-01", cookies: supportSession.cookies });
  assert.equal(forbidden.statusCode, 403);

  const ok = await app.inject({ method: "GET", url: "/admin/finance/revenue?from=2020-01-01&to=2030-01-01", cookies: financeSession.cookies });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.json().data.totals.fees_kz >= 500);
  assert.ok(ok.json().data.totals.commissions_kz >= 1200);
});

test("levantamentos: regras de valor, aprovação e pagamento; finança não autorizada é rejeitada", async () => {
  const financeAdmin = await insertAdminAccount("finance", "finance-withdrawals");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const supportAdmin = await insertAdminAccount("support", "finance-withdrawals-support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const provider = await insertProviderAccount("finance-withdrawal", { accountStatus: "active" });
  providerAccountIds.push(provider.id);
  await db.insert(schema.wallets).values({ providerAccountId: provider.id, balanceKz: 10000 });

  const forbidden = await app.inject({
    method: "POST",
    url: "/admin/finance/withdrawals",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: { provider_id: provider.id, amount_kz: 6000 },
  });
  assert.equal(forbidden.statusCode, 403);

  const belowMinimum = await app.inject({
    method: "POST",
    url: "/admin/finance/withdrawals",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: provider.id, amount_kz: 1000 },
  });
  assert.equal(belowMinimum.statusCode, 422);

  const tooMuch = await app.inject({
    method: "POST",
    url: "/admin/finance/withdrawals",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: provider.id, amount_kz: 50000 },
  });
  assert.equal(tooMuch.statusCode, 422);

  const create = await app.inject({
    method: "POST",
    url: "/admin/finance/withdrawals",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: provider.id, amount_kz: 6000 },
  });
  assert.equal(create.statusCode, 200);
  const withdrawalId = create.json().data.id;
  withdrawalIds.push(withdrawalId);
  assert.equal(create.json().data.status, "pending");

  const list = await app.inject({ method: "GET", url: "/admin/finance/withdrawals?status=pending", cookies: financeSession.cookies });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === withdrawalId));

  const approve = await app.inject({
    method: "POST",
    url: `/admin/finance/withdrawals/${withdrawalId}/approve`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().data.status, "approved");

  const approveAgain = await app.inject({
    method: "POST",
    url: `/admin/finance/withdrawals/${withdrawalId}/approve`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
  });
  assert.equal(approveAgain.statusCode, 409);

  const markPaidNoReference = await app.inject({
    method: "POST",
    url: `/admin/finance/withdrawals/${withdrawalId}/mark-paid`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: {},
  });
  assert.equal(markPaidNoReference.statusCode, 422);

  const markPaid = await app.inject({
    method: "POST",
    url: `/admin/finance/withdrawals/${withdrawalId}/mark-paid`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { payment_reference: "TRF-0001" },
  });
  assert.equal(markPaid.statusCode, 200);
  assert.equal(markPaid.json().data.status, "paid");

  const [wallet] = await db.select().from(schema.wallets).where(inArray(schema.wallets.providerAccountId, [provider.id]));
  assert.equal(wallet?.balanceKz, 4000);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, [financeAdmin.id]));
  assert.ok(auditRows.some((row) => row.action === "withdrawal.paid"));
});

test("lotes de pagamento: criação, envio e cancelamento", async () => {
  const financeAdmin = await insertAdminAccount("finance", "finance-batches");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const provider = await insertProviderAccount("finance-batch", { accountStatus: "active" });
  providerAccountIds.push(provider.id);
  await db.insert(schema.wallets).values({ providerAccountId: provider.id, balanceKz: 20000 });

  const create = await app.inject({
    method: "POST",
    url: "/admin/finance/withdrawals",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: provider.id, amount_kz: 7000 },
  });
  const withdrawalId = create.json().data.id;
  withdrawalIds.push(withdrawalId);

  const batchWithoutApproval = await app.inject({
    method: "POST",
    url: "/admin/finance/batches",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { withdrawal_ids: [withdrawalId] },
  });
  assert.equal(batchWithoutApproval.statusCode, 422);

  await app.inject({
    method: "POST",
    url: `/admin/finance/withdrawals/${withdrawalId}/approve`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
  });

  const createBatch = await app.inject({
    method: "POST",
    url: "/admin/finance/batches",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { withdrawal_ids: [withdrawalId] },
  });
  assert.equal(createBatch.statusCode, 200);
  const batchId = createBatch.json().data.id;
  batchIds.push(batchId);
  assert.equal(createBatch.json().data.status, "draft");

  const send = await app.inject({
    method: "POST",
    url: `/admin/finance/batches/${batchId}/send`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
  });
  assert.equal(send.statusCode, 200);
  assert.equal(send.json().data.status, "sent");

  const cancelNoReason = await app.inject({
    method: "POST",
    url: `/admin/finance/batches/${batchId}/cancel`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: {},
  });
  assert.equal(cancelNoReason.statusCode, 422);

  const cancel = await app.inject({
    method: "POST",
    url: `/admin/finance/batches/${batchId}/cancel`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { reason: "Dados bancários incorrectos." },
  });
  assert.equal(cancel.statusCode, 200);
  assert.equal(cancel.json().data.status, "cancelled");

  const [withdrawalRow] = await db.select().from(schema.withdrawals).where(inArray(schema.withdrawals.id, [withdrawalId]));
  assert.equal(withdrawalRow?.batchId, null);
});
