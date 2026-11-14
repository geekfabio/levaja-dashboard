import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { setPricingOverrideForTests } from "../src/lib/pricing-config";
import { insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const providerAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const requestIds: string[] = [];
const promotionIds: string[] = [];

const PICKUP = placeFixture("plc-promo-a", -8.8256, 13.2311);
const DROPOFF = placeFixture("plc-promo-b", -8.9167, 13.1833);

before(async () => {
  app = await buildApp();
});

after(async () => {
  setPricingOverrideForTests(null);
  if (promotionIds.length > 0) await db.delete(schema.promotions).where(inArray(schema.promotions.id, promotionIds));
  if (clientAccountIds.length > 0) await db.delete(schema.referralRewards).where(inArray(schema.referralRewards.clientAccountId, clientAccountIds));
  if (requestIds.length > 0) {
    await db.delete(schema.payments).where(inArray(schema.payments.requestId, requestIds));
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.providerAccountId, providerAccountIds));
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, providerAccountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  }
  if (clientAccountIds.length > 0) await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientAccountIds));
  const allAccounts = [...providerAccountIds, ...clientAccountIds];
  if (allAccounts.length > 0) await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  await app.close();
});

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function newClient(tag: string) {
  const client = await insertClientAccount(tag);
  clientAccountIds.push(client.id);
  return client;
}

async function newProvider(tag: string) {
  const provider = await insertProviderAccount(tag, { online: true });
  providerAccountIds.push(provider.id);
  return provider;
}

async function insertPromotion(overrides: Partial<typeof schema.promotions.$inferInsert> = {}) {
  const id = newId("promo");
  const code = `T${id.slice(-9).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
  await db.insert(schema.promotions).values({
    id,
    code,
    name: "Promoção de teste",
    kind: "fixed",
    value: 1000,
    minOrderKz: 0,
    startsAt: new Date(Date.now() - 3600_000),
    endsAt: new Date(Date.now() + 3600_000),
    budgetKz: 100_000,
    perClientLimit: 1,
    createdByAccountId: "teste",
    ...overrides,
  });
  promotionIds.push(id);
  return { id, code };
}

async function createRequest(client: { id: string; token: string }, extra: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: "POST",
    url: "/requests",
    headers: auth(client.token),
    payload: { service_type: "tow", client_id: client.id, pickup: PICKUP, dropoff: DROPOFF, payment_method: "cash", ...extra },
  });
  if (res.statusCode === 201) requestIds.push(res.json().data.id);
  return res;
}

/** Takes a freshly created request straight to "in_transit" with this provider, then delivers it through the real endpoint. */
async function deliver(requestId: string, provider: { id: string; token: string }) {
  await db.update(schema.serviceRequests).set({ status: "in_transit", providerAccountId: provider.id }).where(eq(schema.serviceRequests.id, requestId));
  return app.inject({
    method: "POST",
    url: `/requests/${requestId}/proof`,
    headers: auth(provider.token),
    payload: { photos: [], signed_by: "Cliente de Teste", good_condition: true },
  });
}

test("numerário: a entrega fecha o pedido como pago, sem passo de pagamento na app", async () => {
  const client = await newClient("cash-auto-pay");
  const provider = await newProvider("cash-auto-pay");

  const created = await createRequest(client);
  assert.equal(created.statusCode, 201);
  const requestId = created.json().data.id as string;

  const delivered = await deliver(requestId, provider);
  assert.equal(delivered.statusCode, 200);
  const body = delivered.json().data;
  assert.equal(body.status, "paid");
  assert.deepEqual(body.timeline.slice(-2).map((entry: { status: string }) => entry.status), ["delivered", "paid"]);

  const payments = await db.select().from(schema.payments).where(eq(schema.payments.requestId, requestId));
  assert.equal(payments.length, 1);
  assert.equal(payments[0]!.paymentMethod, "cash");
  assert.equal(payments[0]!.status, "confirmed");
  assert.equal(payments[0]!.amountKz, body.pricing.total_kz);
});

test("código promocional: desconta no pedido, respeita o limite por cliente e é devolvido ao cancelar", async () => {
  const client = await newClient("promo-apply");
  const promotion = await insertPromotion();

  const preview = await app.inject({
    method: "POST",
    url: "/promotions/validate",
    headers: auth(client.token),
    payload: { code: promotion.code.toLowerCase(), service_type: "tow", pickup: { lat: PICKUP.lat, lng: PICKUP.lng }, total_kz: 9000 },
  });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.json().data.discount_kz, 1000);

  const invalid = await app.inject({
    method: "POST",
    url: "/promotions/validate",
    headers: auth(client.token),
    payload: { code: "NAOEXISTE1", service_type: "tow", pickup: { lat: PICKUP.lat, lng: PICKUP.lng }, total_kz: 9000 },
  });
  assert.equal(invalid.statusCode, 422);

  const first = await createRequest(client, { promo_code: promotion.code });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().data.pricing.discount_kz, 1000);
  assert.match(first.json().data.pricing.discount_label, new RegExp(promotion.code));

  const second = await createRequest(client, { promo_code: promotion.code });
  assert.equal(second.statusCode, 422);

  const cancel = await app.inject({ method: "POST", url: `/requests/${first.json().data.id}/cancel`, headers: auth(client.token), payload: { reason: "Teste" } });
  assert.equal(cancel.statusCode, 200);

  const again = await createRequest(client, { promo_code: promotion.code });
  assert.equal(again.statusCode, 201);
  assert.equal(again.json().data.pricing.discount_kz, 1000);
});

test("código promocional: percentagem com tecto, serviço errado e promoção em pausa", async () => {
  const client = await newClient("promo-rules");
  const percent = await insertPromotion({ kind: "percent", value: 10, maxDiscountKz: 400 });
  const cargoOnly = await insertPromotion({ services: ["cargo"] });
  const paused = await insertPromotion({ paused: true });

  const capped = await createRequest(client, { promo_code: percent.code });
  assert.equal(capped.statusCode, 201);
  assert.equal(capped.json().data.pricing.discount_kz, 400);

  assert.equal((await createRequest(client, { promo_code: cargoOnly.code })).statusCode, 422);
  assert.equal((await createRequest(client, { promo_code: paused.code })).statusCode, 422);
});

test("desconto e bónus são crédito do prestador: abatem ao que ele deve à plataforma", async () => {
  setPricingOverrideForTests({ driver_bonus_kz: 300 });
  const client = await newClient("promo-credit");
  const provider = await newProvider("promo-credit");
  const promotion = await insertPromotion();

  const created = await createRequest(client, { promo_code: promotion.code });
  const request = created.json().data;
  const delivered = await deliver(request.id, provider);
  assert.equal(delivered.json().data.status, "paid");

  const payments = await db.select().from(schema.payments).where(eq(schema.payments.requestId, request.id));
  assert.equal(payments[0]!.amountKz, request.pricing.total_kz - 1000);

  const balance = await app.inject({ method: "GET", url: `/providers/${provider.id}/balance`, headers: auth(provider.token) });
  assert.equal(balance.statusCode, 200);
  const data = balance.json().data;
  assert.equal(data.bonus_kz, 300);
  assert.equal(data.credits_kz, 1300);
  assert.equal(data.balance_kz, 1300 - data.owed_kz);

  const state = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  const bonus = state.json().data.wallet.transactions.find((tx: { type: string }) => tx.type === "bonus");
  assert.ok(bonus);
  assert.equal(bonus.amount_kz, 300);
  setPricingOverrideForTests(null);
});

test("convite: o convidado ganha desconto no primeiro pedido e quem convidou ganha quando esse pedido é pago", async () => {
  setPricingOverrideForTests({ referral_invitee_discount_kz: 500, referral_inviter_discount_kz: 700 });
  const inviter = await newClient("referral-inviter");
  const invitee = await newClient("referral-invitee");
  const provider = await newProvider("referral");

  const mine = await app.inject({ method: "GET", url: "/referrals/me", headers: auth(inviter.token) });
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.json().data.enabled, true);
  const code = mine.json().data.code as string;
  assert.match(code, /^[A-Z0-9]{8}$/);

  const own = await app.inject({ method: "POST", url: "/referrals/redeem", headers: auth(inviter.token), payload: { code } });
  assert.equal(own.statusCode, 422);

  const redeemed = await app.inject({ method: "POST", url: "/referrals/redeem", headers: auth(invitee.token), payload: { code: code.toLowerCase() } });
  assert.equal(redeemed.statusCode, 200);
  assert.equal(redeemed.json().data.available_kz, 500);

  const twice = await app.inject({ method: "POST", url: "/referrals/redeem", headers: auth(invitee.token), payload: { code } });
  assert.equal(twice.statusCode, 422);

  const created = await createRequest(invitee);
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().data.pricing.discount_kz, 500);

  const before = await app.inject({ method: "GET", url: "/referrals/me", headers: auth(inviter.token) });
  assert.equal(before.json().data.available_kz, 0);
  assert.equal(before.json().data.invited_count, 1);

  const delivered = await deliver(created.json().data.id, provider);
  assert.equal(delivered.json().data.status, "paid");

  const afterPaid = await app.inject({ method: "GET", url: "/referrals/me", headers: auth(inviter.token) });
  assert.equal(afterPaid.json().data.available_kz, 700);

  const next = await createRequest(inviter);
  assert.equal(next.json().data.pricing.discount_kz, 700);
  setPricingOverrideForTests(null);
});

test("convites desligados (valores a 0): o código não pode ser usado", async () => {
  setPricingOverrideForTests({ referral_invitee_discount_kz: 0, referral_inviter_discount_kz: 0 });
  const inviter = await newClient("referral-off-a");
  const invitee = await newClient("referral-off-b");
  const mine = await app.inject({ method: "GET", url: "/referrals/me", headers: auth(inviter.token) });
  assert.equal(mine.json().data.enabled, false);
  const res = await app.inject({ method: "POST", url: "/referrals/redeem", headers: auth(invitee.token), payload: { code: mine.json().data.code } });
  assert.equal(res.statusCode, 422);
  setPricingOverrideForTests(null);
});
