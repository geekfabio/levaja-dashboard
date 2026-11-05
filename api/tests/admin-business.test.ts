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
const businessIds: string[] = [];
const requestIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (businessIds.length > 0) {
    await db.delete(schema.businessStatements).where(inArray(schema.businessStatements.businessId, businessIds));
    await db.delete(schema.businessMembers).where(inArray(schema.businessMembers.businessId, businessIds));
    await db.delete(schema.businessAccounts).where(inArray(schema.businessAccounts.id, businessIds));
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

function contractPayload() {
  const now = new Date();
  const starts = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ends = new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000);
  return {
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    discount_rate: 0.1,
    payment_terms_days: 30,
    credit_limit_kz: 500000,
  };
}

async function createSettledRequest(clientId: string, totalKz: number, paidAt: Date) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: "cargo",
    status: "paid",
    clientAccountId: clientId,
    pickup: placeFixture("plc-maianga", -8.8256, 13.2311),
    stops: [],
    photos: [],
    pickupPhotos: [],
    pricing: { base_kz: totalKz, distance_kz: 0, extras_kz: 0, platform_fee_kz: 0, total_kz: totalKz },
    paymentMethod: "cash",
    createdAt: paidAt,
    updatedAt: paidAt,
  });
  await db.insert(schema.serviceRequestEvents).values({ id: newId("evt"), requestId: id, status: "paid", actor: "system", at: paidAt });
  requestIds.push(id);
  return id;
}

test("cria conta empresarial, valida NIF duplicado e gere membros", async () => {
  const admin = await insertAdminAccount("finance", "biz-manage");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const nif = `${5000000000 + Math.floor(Math.random() * 999999)}`;
  const create = await app.inject({
    method: "POST",
    url: "/admin/business-accounts",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      name: "Transportes Kianda, Lda.",
      nif,
      sector: "Logística",
      contact_name: "Manuel dos Santos",
      phone: "+244 923 111 222",
      email: "geral@kianda.ao",
      contract: contractPayload(),
    },
  });
  assert.equal(create.statusCode, 200);
  const business = create.json().data;
  businessIds.push(business.id);
  assert.equal(business.status, "active");
  assert.equal(business.members, 0);

  const duplicateNif = await app.inject({
    method: "POST",
    url: "/admin/business-accounts",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      name: "Outra Empresa, Lda.",
      nif,
      sector: "Logística",
      contact_name: "Outro Responsável",
      phone: "+244 923 111 333",
      email: "geral@outra.ao",
      contract: contractPayload(),
    },
  });
  assert.equal(duplicateNif.statusCode, 422);
  assert.equal(duplicateNif.json().error.code, "validation");

  const client = await insertClientAccount("biz-member");
  clientAccountIds.push(client.id);

  const candidatesBefore = await app.inject({ method: "GET", url: "/admin/business-accounts/candidates", cookies: session.cookies });
  assert.equal(candidatesBefore.statusCode, 200);
  assert.ok(candidatesBefore.json().data.some((item: { id: string }) => item.id === client.id));

  const addMember = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/members`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { client_id: client.id },
  });
  assert.equal(addMember.statusCode, 200);
  assert.equal(addMember.json().data.members, 1);

  const candidatesAfter = await app.inject({ method: "GET", url: "/admin/business-accounts/candidates", cookies: session.cookies });
  assert.ok(!candidatesAfter.json().data.some((item: { id: string }) => item.id === client.id));

  const duplicateMember = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/members`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { client_id: client.id },
  });
  assert.equal(duplicateMember.statusCode, 422);

  const removeWithoutReason = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/members/${client.id}/remove`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(removeWithoutReason.statusCode, 422);

  const remove = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/members/${client.id}/remove`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Cliente saiu da empresa." },
  });
  assert.equal(remove.statusCode, 200);
  assert.equal(remove.json().data.members, 0);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [business.id]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["business.create", "business.member_add", "business.member_remove"]);
});

test("calcula extractos mensais com desconto e marca como pago", async () => {
  const admin = await insertAdminAccount("finance", "biz-statements");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const client = await insertClientAccount("biz-stmt-member");
  clientAccountIds.push(client.id);

  const contract = contractPayload();
  const create = await app.inject({
    method: "POST",
    url: "/admin/business-accounts",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      name: "Mudanças Luanda, Lda.",
      nif: `${5100000000 + Math.floor(Math.random() * 999999)}`,
      sector: "Mudanças",
      contact_name: "Joana Ferreira",
      phone: "+244 924 555 666",
      email: "geral@mudancasluanda.ao",
      contract,
    },
  });
  assert.equal(create.statusCode, 200);
  const business = create.json().data;
  businessIds.push(business.id);

  await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/members`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { client_id: client.id },
  });

  const lastMonthPaidAt = new Date();
  lastMonthPaidAt.setUTCMonth(lastMonthPaidAt.getUTCMonth() - 1, 15);
  await createSettledRequest(client.id, 20000, lastMonthPaidAt);

  const detail = await app.inject({ method: "GET", url: `/admin/business-accounts/${business.id}`, cookies: session.cookies });
  assert.equal(detail.statusCode, 200);
  const statements = detail.json().data.statements as { month: string; status: string; net: number; gross: number }[];
  const closed = statements.find((item) => item.status === "due" || item.status === "overdue");
  assert.ok(closed, "esperava um extracto de um mês já fechado");
  assert.equal(closed!.gross, 20000);
  assert.equal(closed!.net, 18000);

  const markPaidNoReference = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/statements/${closed!.month}/paid`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(markPaidNoReference.statusCode, 422);

  const markPaid = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/statements/${closed!.month}/paid`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reference: "PGTO-0001" },
  });
  assert.equal(markPaid.statusCode, 200);
  const updatedStatement = markPaid.json().data.statements.find((item: { month: string }) => item.month === closed!.month);
  assert.equal(updatedStatement.status, "paid");

  const markPaidAgain = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/statements/${closed!.month}/paid`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reference: "PGTO-0002" },
  });
  assert.equal(markPaidAgain.statusCode, 409);
  assert.equal(markPaidAgain.json().error.code, "invalid_transition");
});

test("suspende e reactiva uma conta empresarial, exigindo motivo", async () => {
  const admin = await insertAdminAccount("finance", "biz-suspend");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const create = await app.inject({
    method: "POST",
    url: "/admin/business-accounts",
    cookies: session.cookies,
    headers: session.headers,
    payload: {
      name: "Reboques Bengo, Lda.",
      nif: `${5200000000 + Math.floor(Math.random() * 999999)}`,
      sector: "Reboque",
      contact_name: "Pedro Neto",
      phone: "+244 925 777 888",
      email: "geral@reboquesbengo.ao",
      contract: contractPayload(),
    },
  });
  const business = create.json().data;
  businessIds.push(business.id);

  const suspendNoReason = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/suspend`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(suspendNoReason.statusCode, 422);

  const suspend = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/suspend`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Pagamento em atraso há mais de 90 dias." },
  });
  assert.equal(suspend.statusCode, 200);
  assert.equal(suspend.json().data.status, "suspended");

  const client = await insertClientAccount("biz-suspend-member");
  clientAccountIds.push(client.id);
  const blockedAdd = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/members`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { client_id: client.id },
  });
  assert.equal(blockedAdd.statusCode, 409);

  const doubleSuspend = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/suspend`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetir suspensão." },
  });
  assert.equal(doubleSuspend.statusCode, 409);

  const reactivate = await app.inject({
    method: "POST",
    url: `/admin/business-accounts/${business.id}/reactivate`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Pagamento regularizado." },
  });
  assert.equal(reactivate.statusCode, 200);
  assert.equal(reactivate.json().data.status, "active");
});

test("suporte não gere contas empresariais (forbidden)", async () => {
  const supportAdmin = await insertAdminAccount("support", "biz-support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const forbidden = await app.inject({
    method: "POST",
    url: "/admin/business-accounts",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: {
      name: "Empresa Teste",
      nif: "5999999999",
      contact_name: "Alguém",
      phone: "+244 926 000 111",
      email: "geral@teste.ao",
      contract: contractPayload(),
    },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const list = await app.inject({ method: "GET", url: "/admin/business-accounts", cookies: supportSession.cookies });
  assert.equal(list.statusCode, 200);
});
