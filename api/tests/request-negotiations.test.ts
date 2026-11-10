import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { signAccessToken } from "../src/lib/jwt";

let app: FastifyInstance;

const accountIds: string[] = [];
const requestIds: string[] = [];

function testEmail(tag: string) {
  return `teste-negociacao-${tag}-${randomUUID()}@angoleva.ao`;
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

function createRequestBody(clientId: string) {
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
  };
}

async function createRequest(client: { id: string; token: string }) {
  const res = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  assert.equal(res.statusCode, 201);
  const body = res.json().data;
  requestIds.push(body.id);
  return body;
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, accountIds));
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("prestador abre negociação, baixa o preço, cliente aceita e o pedido fica atribuído ao valor negociado", async () => {
  const client = await createClient("fluxo");
  const provider = await createProvider("fluxo");
  const request = await createRequest(client);
  const baseAmountKz = request.pricing.total_kz - request.pricing.platform_fee_kz;

  const open = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations`, headers: auth(provider.token), payload: { direction: "down" } });
  assert.equal(open.statusCode, 201);
  const negotiation = open.json().data;
  assert.equal(negotiation.amount_kz, baseAmountKz - 50);
  assert.equal(negotiation.by, "provider");
  assert.equal(negotiation.status, "pending");

  const list = await app.inject({ method: "GET", url: `/requests/${request.id}/negotiations`, headers: auth(client.token) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.length, 1);

  const accept = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations/${negotiation.id}/accept`, headers: auth(client.token) });
  assert.equal(accept.statusCode, 200);
  const updated = accept.json().data;
  assert.equal(updated.status, "assigned");
  assert.equal(updated.provider_id, provider.id);
  assert.equal(updated.pricing.total_kz, baseAmountKz - 50 + request.pricing.platform_fee_kz);
});

test("cliente contra-propõe, prestador aceita a contra-proposta", async () => {
  const client = await createClient("contra");
  const provider = await createProvider("contra");
  const request = await createRequest(client);
  const baseAmountKz = request.pricing.total_kz - request.pricing.platform_fee_kz;

  const open = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations`, headers: auth(provider.token), payload: { direction: "up" } });
  const negotiation = open.json().data;
  assert.equal(negotiation.amount_kz, baseAmountKz + 50);

  const counter = await app.inject({
    method: "POST",
    url: `/requests/${request.id}/negotiations/${negotiation.id}/adjust`,
    headers: auth(client.token),
    payload: { direction: "down" },
  });
  assert.equal(counter.statusCode, 200);
  const countered = counter.json().data;
  assert.equal(countered.amount_kz, baseAmountKz);
  assert.equal(countered.by, "client");

  const accept = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations/${negotiation.id}/accept`, headers: auth(provider.token) });
  assert.equal(accept.statusCode, 200);
  assert.equal(accept.json().data.provider_id, provider.id);
});

test("não é possível aceitar a própria proposta", async () => {
  const client = await createClient("auto-aceitar");
  const provider = await createProvider("auto-aceitar");
  const request = await createRequest(client);

  const open = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations`, headers: auth(provider.token), payload: { direction: "down" } });
  const negotiation = open.json().data;

  const accept = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations/${negotiation.id}/accept`, headers: auth(provider.token) });
  assert.equal(accept.statusCode, 409);
  assert.equal(accept.json().error.code, "invalid_transition");
});

test("o valor não ultrapassa os limites e aceitar cancela as outras negociações pendentes", async () => {
  const client = await createClient("limites");
  const providerA = await createProvider("limites-a");
  const providerB = await createProvider("limites-b");
  const request = await createRequest(client);
  const baseAmountKz = request.pricing.total_kz - request.pricing.platform_fee_kz;

  const openA = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations`, headers: auth(providerA.token), payload: { direction: "up" } });
  const negotiationA = openA.json().data;
  const { max_kz: maxKz } = negotiationA;

  let last = negotiationA;
  for (let i = 0; i < 40; i += 1) {
    const res = await app.inject({
      method: "POST",
      url: `/requests/${request.id}/negotiations/${negotiationA.id}/adjust`,
      headers: auth(client.token),
      payload: { direction: "up" },
    });
    last = res.json().data;
    if (last.amount_kz >= maxKz) break;
  }
  assert.equal(last.amount_kz, maxKz);
  assert.ok(maxKz > baseAmountKz);

  const openB = await app.inject({ method: "POST", url: `/requests/${request.id}/negotiations`, headers: auth(providerB.token), payload: { direction: "down" } });
  const negotiationB = openB.json().data;

  const accept = await app.inject({
    method: "POST",
    url: `/requests/${request.id}/negotiations/${negotiationA.id}/accept`,
    headers: auth(providerA.token),
  });
  assert.equal(accept.statusCode, 200);
  assert.equal(accept.json().data.provider_id, providerA.id);

  const listB = await app.inject({ method: "GET", url: `/requests/${request.id}/negotiations`, headers: auth(providerB.token) });
  assert.equal(listB.json().data.find((item: { id: string }) => item.id === negotiationB.id).status, "cancelled");
});

test("sem autenticação devolve unauthorized; prestador offline não pode abrir negociação", async () => {
  const client = await createClient("sem-auth");
  const offline = await createProvider("offline", { online: false });
  const request = await createRequest(client);

  const noAuth = await app.inject({ method: "GET", url: `/requests/${request.id}/negotiations` });
  assert.equal(noAuth.statusCode, 401);

  const offlineAttempt = await app.inject({
    method: "POST",
    url: `/requests/${request.id}/negotiations`,
    headers: auth(offline.token),
    payload: { direction: "down" },
  });
  assert.equal(offlineAttempt.statusCode, 403);
});
