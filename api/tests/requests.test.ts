import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { signAccessToken } from "../src/lib/jwt";

let app: FastifyInstance;

const accountIds: string[] = [];
const requestIds: string[] = [];

function testEmail(tag: string) {
  return `teste-pedidos-${tag}-${randomUUID()}@angoleva.ao`;
}

async function createClient(tag: string) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "client", email, phone: "+244 923 000 000", fullName: `Cliente ${tag}`, active: true });
  await db.insert(schema.clients).values({ accountId: id });
  accountIds.push(id);
  const { token } = await signAccessToken({ sub: id, kind: "client", email });
  return { id, token };
}

async function createProvider(tag: string, options: { online?: boolean } = {}) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "provider", email, phone: "+244 912 000 000", fullName: `Prestador ${tag}`, active: true });
  await db.insert(schema.providers).values({ accountId: id, online: options.online ?? true });
  accountIds.push(id);
  const { token } = await signAccessToken({ sub: id, kind: "provider", email });
  return { id, token };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

function place(id: string, lat: number, lng: number) {
  return { id, label: id, district: "Maianga", city: "Luanda", lat, lng };
}

const PICKUP = place("plc-maianga", -8.8256, 13.2311);
const DROPOFF = place("plc-talatona", -8.9167, 13.1833);

function createRequestBody(clientId: string, overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function movingRequestBody(clientId: string) {
  return createRequestBody(clientId, {
    service_type: "house_move",
    tow_details: null,
    moving_details: {
      property_type: "t2",
      rooms: 3,
      items: "Mobília de sala e quartos",
      helpers: 2,
      pickup_floor: 2,
      delivery_floor: 0,
      elevator: false,
      disassembly: true,
      when: "now",
      date: null,
      time: null,
    },
  });
}

async function cleanup() {
  if (requestIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.requestId, requestIds));
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.wallets).where(inArray(schema.wallets.providerAccountId, accountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, accountIds));
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  await cleanup();
  await app.close();
});

test("criar um pedido calcula o preço, o ganho do prestador e o código", async () => {
  const client = await createClient("criar");
  const res = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  assert.equal(res.statusCode, 201);

  const body = res.json().data;
  requestIds.push(body.id);

  assert.match(body.code, /^AL-\d+$/);
  assert.equal(body.status, "searching");
  assert.equal(body.client_id, client.id);
  assert.equal(body.provider_id, null);
  assert.ok(body.distance_km >= 2);
  assert.ok(body.duration_min >= 8);
  assert.equal(body.pricing.platform_fee_kz, 500);
  assert.equal(body.pricing.total_kz, body.pricing.base_kz + body.pricing.distance_kz + body.pricing.extras_kz + body.pricing.platform_fee_kz);
  const expectedEarning = Math.floor(((body.pricing.total_kz - 500) * 0.85) / 500) * 500;
  assert.equal(body.provider_earning_kz, expectedEarning);
  assert.equal(body.timeline.length, 1);
  assert.equal(body.timeline[0].status, "searching");
});

test("percurso completo searching → delivered com os actores certos e crédito na carteira", async () => {
  const client = await createClient("fluxo");
  const provider = await createProvider("fluxo", { online: true });

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  assert.equal(create.statusCode, 201);
  const reqId = create.json().data.id;
  requestIds.push(reqId);
  const providerEarning = create.json().data.provider_earning_kz;

  const accept = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/accept`,
    headers: auth(provider.token),
    payload: { provider_id: provider.id },
  });
  assert.equal(accept.statusCode, 200);
  assert.equal(accept.json().data.status, "assigned");
  assert.equal(accept.json().data.provider_id, provider.id);

  const enRoute = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(provider.token),
    payload: { to: "en_route", actor: "provider" },
  });
  assert.equal(enRoute.statusCode, 200);

  const arrived = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(provider.token),
    payload: { to: "arrived", actor: "provider" },
  });
  assert.equal(arrived.statusCode, 200);

  const pickupConfirmed = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(client.token),
    payload: { to: "pickup_confirmed", actor: "client" },
  });
  assert.equal(pickupConfirmed.statusCode, 200);

  const inTransit = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(provider.token),
    payload: { to: "in_transit", actor: "provider" },
  });
  assert.equal(inTransit.statusCode, 200);

  const proof = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proof`,
    headers: auth(provider.token),
    payload: { photos: [], signed_by: "Armando Manuel", good_condition: true, notes: null },
  });
  assert.equal(proof.statusCode, 200);
  assert.equal(proof.json().data.status, "delivered");
  assert.ok(proof.json().data.proof.delivered_at);

  const timelineStatuses = proof.json().data.timeline.map((event: { status: string }) => event.status);
  assert.deepEqual(timelineStatuses, ["searching", "assigned", "en_route", "arrived", "pickup_confirmed", "in_transit", "delivered"]);

  const [walletRow] = await db.select().from(schema.wallets).where(eq(schema.wallets.providerAccountId, provider.id));
  assert.equal(walletRow?.balanceKz, providerEarning);

  const transactions = await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.requestId, reqId));
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0]!.amountKz, providerEarning);
  assert.equal(transactions[0]!.status, "completed");
  assert.equal(transactions[0]!.type, "earning");

  const secondProof = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proof`,
    headers: auth(provider.token),
    payload: { photos: [], signed_by: "Armando Manuel", good_condition: true, notes: null },
  });
  assert.equal(secondProof.statusCode, 409);
});

test("transição com actor errado é rejeitada (forbidden)", async () => {
  const client = await createClient("actor-errado");
  const provider = await createProvider("actor-errado");
  const impostor = await createProvider("actor-errado-impostor");

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);
  await app.inject({ method: "POST", url: `/requests/${reqId}/accept`, headers: auth(provider.token), payload: { provider_id: provider.id } });

  const wrongRole = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(client.token),
    payload: { to: "en_route", actor: "client" },
  });
  assert.equal(wrongRole.statusCode, 403);
  assert.equal(wrongRole.json().error.code, "forbidden");

  const wrongProvider = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(impostor.token),
    payload: { to: "en_route", actor: "provider" },
  });
  assert.equal(wrongProvider.statusCode, 403);
  assert.equal(wrongProvider.json().error.code, "forbidden");

  const systemActor = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(provider.token),
    payload: { to: "en_route", actor: "system" },
  });
  assert.equal(systemActor.statusCode, 403);
});

test("transição fora de sequência é rejeitada (invalid_transition)", async () => {
  const client = await createClient("fora-sequencia");
  const provider = await createProvider("fora-sequencia");

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);
  await app.inject({ method: "POST", url: `/requests/${reqId}/accept`, headers: auth(provider.token), payload: { provider_id: provider.id } });

  const skipAhead = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/transitions`,
    headers: auth(provider.token),
    payload: { to: "delivered", actor: "provider" },
  });
  assert.equal(skipAhead.statusCode, 409);
  assert.equal(skipAhead.json().error.code, "invalid_transition");
});

test("cancelar em searching funciona; cancelar depois de pickup_confirmed é rejeitado", async () => {
  const client = await createClient("cancelar");
  const provider = await createProvider("cancelar");

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  const cancel = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/cancel`,
    headers: auth(client.token),
    payload: { reason: "Já não preciso." },
  });
  assert.equal(cancel.statusCode, 200);
  assert.equal(cancel.json().data.status, "cancelled");
  assert.equal(cancel.json().data.cancel_reason, "Já não preciso.");

  const create2 = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId2 = create2.json().data.id;
  requestIds.push(reqId2);
  await app.inject({ method: "POST", url: `/requests/${reqId2}/accept`, headers: auth(provider.token), payload: { provider_id: provider.id } });
  await app.inject({ method: "POST", url: `/requests/${reqId2}/transitions`, headers: auth(provider.token), payload: { to: "en_route", actor: "provider" } });
  await app.inject({ method: "POST", url: `/requests/${reqId2}/transitions`, headers: auth(provider.token), payload: { to: "arrived", actor: "provider" } });
  await app.inject({
    method: "POST",
    url: `/requests/${reqId2}/transitions`,
    headers: auth(client.token),
    payload: { to: "pickup_confirmed", actor: "client" },
  });

  const tooLate = await app.inject({
    method: "POST",
    url: `/requests/${reqId2}/cancel`,
    headers: auth(client.token),
    payload: { reason: "Mudei de ideias." },
  });
  assert.equal(tooLate.statusCode, 409);
  assert.equal(tooLate.json().error.code, "invalid_transition");
});

test("proposta de preço: aceite atribui o prestador; recusada devolve a pedido a 'searching'", async () => {
  const client = await createClient("proposta");
  const provider = await createProvider("proposta");

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: movingRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  const proposal = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proposal`,
    headers: auth(provider.token),
    payload: { provider_id: provider.id, amount_kz: 45000, reason: "3 quartos, sem elevador." },
  });
  assert.equal(proposal.statusCode, 200);
  assert.equal(proposal.json().data.provider_id, provider.id);
  assert.equal(proposal.json().data.proposal.status, "sent");
  assert.equal(proposal.json().data.status, "searching");

  const decline = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proposal/answer`,
    headers: auth(client.token),
    payload: { accepted: false },
  });
  assert.equal(decline.statusCode, 200);
  assert.equal(decline.json().data.provider_id, null);
  assert.equal(decline.json().data.proposal.status, "declined");
  assert.equal(decline.json().data.status, "searching");

  const secondProposal = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proposal`,
    headers: auth(provider.token),
    payload: { provider_id: provider.id, amount_kz: 42000, reason: "Proposta revista." },
  });
  assert.equal(secondProposal.statusCode, 200);

  const accept = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proposal/answer`,
    headers: auth(client.token),
    payload: { accepted: true },
  });
  assert.equal(accept.statusCode, 200);
  assert.equal(accept.json().data.status, "assigned");
  assert.equal(accept.json().data.provider_id, provider.id);
  assert.equal(accept.json().data.pricing.total_kz, 42000 + 500);
});

test("regras de acesso: um utilizador não vê nem altera o pedido de outro", async () => {
  const clientA = await createClient("acesso-a");
  const clientB = await createClient("acesso-b");
  const providerX = await createProvider("acesso-x");
  const providerY = await createProvider("acesso-y");

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(clientA.token), payload: createRequestBody(clientA.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  const otherClientView = await app.inject({ method: "GET", url: `/requests/${reqId}`, headers: auth(clientB.token) });
  assert.equal(otherClientView.statusCode, 403);
  assert.equal(otherClientView.json().error.code, "forbidden");

  const anyProviderView = await app.inject({ method: "GET", url: `/requests/${reqId}`, headers: auth(providerX.token) });
  assert.equal(anyProviderView.statusCode, 200);

  const acceptedByOther = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/accept`,
    headers: auth(providerY.token),
    payload: { provider_id: providerX.id },
  });
  assert.equal(acceptedByOther.statusCode, 403);

  await app.inject({ method: "POST", url: `/requests/${reqId}/accept`, headers: auth(providerX.token), payload: { provider_id: providerX.id } });

  const unassignedProviderView = await app.inject({ method: "GET", url: `/requests/${reqId}`, headers: auth(providerY.token) });
  assert.equal(unassignedProviderView.statusCode, 403);

  const wrongCancel = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/cancel`,
    headers: auth(clientB.token),
    payload: { reason: "Não é meu." },
  });
  assert.equal(wrongCancel.statusCode, 403);

  const listOwn = await app.inject({ method: "GET", url: "/requests", headers: auth(clientA.token) });
  assert.equal(listOwn.statusCode, 200);
  assert.ok(listOwn.json().data.some((item: { id: string }) => item.id === reqId));

  const listOther = await app.inject({ method: "GET", url: "/requests", headers: auth(clientB.token) });
  assert.equal(listOther.statusCode, 200);
  assert.ok(!listOther.json().data.some((item: { id: string }) => item.id === reqId));
});

test("GET /requests/changes devolve um cursor e, depois, as alterações posteriores", async () => {
  const client = await createClient("changes");

  const noSince = await app.inject({ method: "GET", url: "/requests/changes", headers: auth(client.token) });
  assert.equal(noSince.statusCode, 200);
  assert.deepEqual(noSince.json().data, []);
  const cursor = noSince.json().meta.cursor;
  assert.ok(cursor);

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id;
  requestIds.push(reqId);

  const withSince = await app.inject({ method: "GET", url: `/requests/changes?since=${encodeURIComponent(cursor)}`, headers: auth(client.token) });
  assert.equal(withSince.statusCode, 200);
  assert.ok(withSince.json().data.some((item: { id: string }) => item.id === reqId));
});
