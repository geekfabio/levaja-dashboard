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
const requestIds: string[] = [];
const cashDepositIds: string[] = [];
const settlementIds: string[] = [];

const PLACE = { id: "plc-billing", label: "Maianga", district: "Maianga", city: "Luanda", lat: -8.83, lng: 13.24 };

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (settlementIds.length > 0) {
    await db.delete(schema.settlementRecords).where(inArray(schema.settlementRecords.id, settlementIds));
  }
  if (cashDepositIds.length > 0) {
    await db.delete(schema.cashDeposits).where(inArray(schema.cashDeposits.id, cashDepositIds));
  }
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (providerAccountIds.length > 0) {
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

async function insertSettledRequest(
  providerId: string,
  clientAccountId: string,
  paymentMethod: "card" | "bank_reference" | "cash",
  totalKz: number,
  platformFeeKz: number,
  providerEarningKz: number,
  paidAt: Date,
) {
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
    paymentMethod,
    pricing: { base_kz: totalKz - platformFeeKz, distance_kz: 0, extras_kz: 0, platform_fee_kz: platformFeeKz, total_kz: totalKz },
    providerEarningKz,
    createdAt: paidAt,
    updatedAt: paidAt,
  });
  requestIds.push(id);
  await db.insert(schema.serviceRequestEvents).values({ id: newId("evt"), requestId: id, status: "paid", actor: "client", at: paidAt });
  return id;
}

test("GET /admin/billing/invoices lista documentos facturados; sem permissão é rejeitado", async () => {
  const supportAdmin = await insertAdminAccount("support", "billing-support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const financeAdmin = await insertAdminAccount("finance", "billing-reader");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const client = await insertClientAccount("billing-invoices");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("billing-invoices", { accountStatus: "active" });
  providerAccountIds.push(provider.id);

  const requestId = await insertSettledRequest(provider.id, client.id, "bank_reference", 9000, 500, 7200, new Date());

  const forbidden = await app.inject({ method: "GET", url: "/admin/billing/invoices", cookies: supportSession.cookies });
  assert.equal(forbidden.statusCode, 403);

  const ok = await app.inject({ method: "GET", url: "/admin/billing/invoices", cookies: financeSession.cookies });
  assert.equal(ok.statusCode, 200);
  const invoice = ok.json().data.find((item: { request_id: string }) => item.request_id === requestId);
  assert.ok(invoice);
  assert.equal(invoice.total, 9000);
  assert.ok(ok.json().meta.totals.invoiced_kz >= 9000);

  const detail = await app.inject({ method: "GET", url: `/admin/billing/invoices/${invoice.id}`, cookies: financeSession.cookies });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.request_id, requestId);

  const missing = await app.inject({ method: "GET", url: "/admin/billing/invoices/ft-does-not-exist", cookies: financeSession.cookies });
  assert.equal(missing.statusCode, 404);
});

test("reconciliação diária: registar, diferença e justificação", async () => {
  const financeAdmin = await insertAdminAccount("finance", "billing-settlements");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const client = await insertClientAccount("billing-settlements");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("billing-settlements", { accountStatus: "active" });
  providerAccountIds.push(provider.id);

  const today = new Date();
  const day = today.toISOString().slice(0, 10);
  await insertSettledRequest(provider.id, client.id, "card", 10000, 500, 8000, today);

  const settlements = await app.inject({ method: "GET", url: `/admin/billing/settlements?from=${day}&to=${day}&method=card`, cookies: financeSession.cookies });
  assert.equal(settlements.statusCode, 200);
  const entry = settlements.json().data.items.find((item: { day: string; method: string }) => item.day === day && item.method === "card");
  assert.ok(entry);
  assert.equal(entry.expected, 10000);
  assert.equal(entry.status, "pending");
  settlementIds.push(entry.id);

  const registerNoReference = await app.inject({
    method: "POST",
    url: `/admin/billing/settlements/${entry.id}/register`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { amount_kz: 9500 },
  });
  assert.equal(registerNoReference.statusCode, 422);

  const register = await app.inject({
    method: "POST",
    url: `/admin/billing/settlements/${entry.id}/register`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { amount_kz: 9500, reference: "EXT-0001" },
  });
  assert.equal(register.statusCode, 200);
  assert.equal(register.json().data.status, "mismatch");

  const registerAgain = await app.inject({
    method: "POST",
    url: `/admin/billing/settlements/${entry.id}/register`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { amount_kz: 9500, reference: "EXT-0002" },
  });
  assert.equal(registerAgain.statusCode, 409);

  const resolve = await app.inject({
    method: "POST",
    url: `/admin/billing/settlements/${entry.id}/resolve`,
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { resolution: "Taxa do gateway já descontada pelo banco." },
  });
  assert.equal(resolve.statusCode, 200);
  assert.equal(resolve.json().data.status, "resolved");
});

test("dívida de numerário: consulta e registo de depósito, com limite da dívida actual", async () => {
  const financeAdmin = await insertAdminAccount("finance", "billing-cash");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const client = await insertClientAccount("billing-cash");
  clientAccountIds.push(client.id);
  const provider = await insertProviderAccount("billing-cash", { accountStatus: "active" });
  providerAccountIds.push(provider.id);

  await insertSettledRequest(provider.id, client.id, "cash", 9000, 500, 7200, new Date());

  const debts = await app.inject({ method: "GET", url: "/admin/billing/cash-debts", cookies: financeSession.cookies });
  assert.equal(debts.statusCode, 200);
  const debt = debts.json().data.find((item: { provider_id: string }) => item.provider_id === provider.id);
  assert.ok(debt);
  assert.equal(debt.balance, 1800);

  const tooMuch = await app.inject({
    method: "POST",
    url: "/admin/billing/cash-deposits",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: provider.id, amount_kz: 5000, reference: "DEP-0001" },
  });
  assert.equal(tooMuch.statusCode, 422);

  const deposit = await app.inject({
    method: "POST",
    url: "/admin/billing/cash-deposits",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: { provider_id: provider.id, amount_kz: 1800, reference: "DEP-0002" },
  });
  assert.equal(deposit.statusCode, 200);
  cashDepositIds.push(deposit.json().data.id);

  const debtsAfter = await app.inject({ method: "GET", url: "/admin/billing/cash-debts?state=all", cookies: financeSession.cookies });
  const debtAfter = debtsAfter.json().data.find((item: { provider_id: string }) => item.provider_id === provider.id);
  assert.equal(debtAfter.balance, 0);

  const deposits = await app.inject({ method: "GET", url: `/admin/billing/cash-deposits?provider_id=${provider.id}`, cookies: financeSession.cookies });
  assert.equal(deposits.statusCode, 200);
  assert.equal(deposits.json().data.length, 1);
});
