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
const zoneIds: string[] = [];

function testEmail(tag: string) {
  return `teste-prestadores-${tag}-${randomUUID()}@angoleva.ao`;
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

async function createProvider(tag: string, options: { online?: boolean; lat?: number; lng?: number } = {}) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "provider", email, phone: "+244 912 000 000", fullName: `Prestador ${tag}`, active: true });
  await db.insert(schema.providers).values({
    accountId: id,
    online: options.online ?? true,
    lat: options.lat !== undefined ? options.lat.toString() : null,
    lng: options.lng !== undefined ? options.lng.toString() : null,
  });
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

async function createZone(name: string) {
  const id = newId("zone");
  await db.insert(schema.zones).values({ id, name, lat: "-8.8256", lng: "13.2311", radiusKm: "12.00" });
  zoneIds.push(id);
  return id;
}

async function createServiceRequest(
  clientId: string,
  overrides: Partial<{
    serviceType: "tow" | "cargo" | "small_move" | "house_move";
    status: "searching" | "assigned" | "delivered" | "paid" | "rated";
    providerAccountId: string | null;
    rating: number | null;
    review: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  const id = newId("req");
  const code = `AL-${10000 + Math.floor(Math.random() * 90000)}-${randomUUID().slice(0, 4)}`;
  const now = new Date();
  await db.insert(schema.serviceRequests).values({
    id,
    code,
    serviceType: overrides.serviceType ?? "tow",
    status: overrides.status ?? "searching",
    clientAccountId: clientId,
    providerAccountId: overrides.providerAccountId ?? null,
    pickup: place("plc-maianga", -8.8256, 13.2311),
    dropoff: place("plc-talatona", -8.9167, 13.1833),
    stops: [],
    photos: [],
    pickupPhotos: [],
    rating: overrides.rating ?? null,
    review: overrides.review ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  });
  requestIds.push(id);
  return id;
}

async function cleanup() {
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (zoneIds.length > 0) {
    await db.delete(schema.zones).where(inArray(schema.zones.id, zoneIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.providerAccountId, accountIds));
    await db.delete(schema.providerDocuments).where(inArray(schema.providerDocuments.providerAccountId, accountIds));
    await db.delete(schema.vehicles).where(inArray(schema.vehicles.providerAccountId, accountIds));
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

test("estado sem viatura e sem documentos vem com os valores por omissão", async () => {
  const provider = await createProvider("estado-vazio");

  const res = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  assert.equal(res.statusCode, 200);

  const body = res.json().data;
  assert.equal(body.profile.id, provider.id);
  assert.equal(body.profile.vehicle, null);
  assert.equal(body.online, true);
  assert.deepEqual(body.coverage, { zone_ids: [], service_types: [] });
  assert.deepEqual(body.documents, []);
  assert.equal(body.wallet.balance_kz, 0);
  assert.deepEqual(body.wallet.transactions, []);
  assert.equal(body.wallet.payout_account, null);
  assert.deepEqual(body.declined_request_ids, []);
});

test("estado com viatura e documento criado reflecte-os", async () => {
  const provider = await createProvider("estado-completo");

  const vehicle = await app.inject({
    method: "PATCH",
    url: `/providers/${provider.id}/vehicle`,
    headers: auth(provider.token),
    payload: { brand: "Isuzu", model: "NPR", plate: "LD-01-01-AA", color: "Branco", class: "tow_truck", category_label: "Reboque plataforma", capacity_kg: 3500, year: 2021 },
  });
  assert.equal(vehicle.statusCode, 200);
  assert.equal(vehicle.json().data.plate, "LD-01-01-AA");

  const doc = await app.inject({
    method: "POST",
    url: `/providers/${provider.id}/documents/doc-license`,
    headers: auth(provider.token),
    payload: { title: "Carta de condução", kind: "license" },
  });
  assert.equal(doc.statusCode, 200);
  assert.equal(doc.json().data.status, "pending");

  const res = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  const body = res.json().data;
  assert.equal(body.profile.vehicle.plate, "LD-01-01-AA");
  assert.equal(body.profile.vehicle.class, "tow_truck");
  assert.equal(body.documents.length, 1);
  assert.equal(body.documents[0].id, "doc-license");
  assert.equal(body.documents[0].status, "pending");
});

test("PATCH vehicle sem todos os campos na primeira vez é rejeitado", async () => {
  const provider = await createProvider("viatura-incompleta");

  const res = await app.inject({
    method: "PATCH",
    url: `/providers/${provider.id}/vehicle`,
    headers: auth(provider.token),
    payload: { brand: "Toyota" },
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error.code, "validation");
});

test("nearby-requests só devolve pedidos da cobertura e exclui recusados", async () => {
  const client = await createClient("nearby");
  const provider = await createProvider("nearby", { lat: -8.83, lng: 13.23 });

  await app.inject({
    method: "PUT",
    url: `/providers/${provider.id}/coverage`,
    headers: auth(provider.token),
    payload: { zone_ids: ["zone-luanda"], service_types: ["tow"] },
  });

  const towRequestId = await createServiceRequest(client.id, { serviceType: "tow" });
  const cargoRequestId = await createServiceRequest(client.id, { serviceType: "cargo" });

  const firstPass = await app.inject({ method: "GET", url: `/providers/${provider.id}/nearby-requests`, headers: auth(provider.token) });
  assert.equal(firstPass.statusCode, 200);
  const firstIds = firstPass.json().data.map((item: { request: { id: string } }) => item.request.id);
  assert.ok(firstIds.includes(towRequestId));
  assert.ok(!firstIds.includes(cargoRequestId));
  const towEntry = firstPass.json().data.find((item: { request: { id: string } }) => item.request.id === towRequestId);
  assert.ok(typeof towEntry.distance_km === "number");

  const decline = await app.inject({
    method: "POST",
    url: `/providers/${provider.id}/declined`,
    headers: auth(provider.token),
    payload: { request_id: towRequestId },
  });
  assert.equal(decline.statusCode, 204);

  const secondPass = await app.inject({ method: "GET", url: `/providers/${provider.id}/nearby-requests`, headers: auth(provider.token) });
  const secondIds = secondPass.json().data.map((item: { request: { id: string } }) => item.request.id);
  assert.ok(!secondIds.includes(towRequestId));
});

test("disponibilidade actualiza o estado online", async () => {
  const provider = await createProvider("disponibilidade", { online: false });

  const off = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  assert.equal(off.json().data.online, false);

  const put = await app.inject({ method: "PUT", url: `/providers/${provider.id}/availability`, headers: auth(provider.token), payload: { online: true } });
  assert.equal(put.statusCode, 204);

  const on = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  assert.equal(on.json().data.online, true);
});

test("cobertura vazia é rejeitada e a válida fica gravada", async () => {
  const provider = await createProvider("cobertura");

  const empty = await app.inject({
    method: "PUT",
    url: `/providers/${provider.id}/coverage`,
    headers: auth(provider.token),
    payload: { zone_ids: [], service_types: ["tow"] },
  });
  assert.equal(empty.statusCode, 422);
  assert.equal(empty.json().error.code, "validation");

  const emptyServices = await app.inject({
    method: "PUT",
    url: `/providers/${provider.id}/coverage`,
    headers: auth(provider.token),
    payload: { zone_ids: ["zone-luanda"], service_types: [] },
  });
  assert.equal(emptyServices.statusCode, 422);

  const ok = await app.inject({
    method: "PUT",
    url: `/providers/${provider.id}/coverage`,
    headers: auth(provider.token),
    payload: { zone_ids: ["zone-luanda", "zone-talatona"], service_types: ["tow", "cargo"] },
  });
  assert.equal(ok.statusCode, 200);

  const state = await app.inject({ method: "GET", url: `/providers/${provider.id}/state`, headers: auth(provider.token) });
  assert.deepEqual(state.json().data.coverage, { zone_ids: ["zone-luanda", "zone-talatona"], service_types: ["tow", "cargo"] });
});

test("levantamento acima do saldo é rejeitado; dentro do saldo cria transacção pendente", async () => {
  const provider = await createProvider("levantamento");
  await db.insert(schema.wallets).values({ providerAccountId: provider.id, balanceKz: 10000 });

  const tooMuch = await app.inject({
    method: "POST",
    url: `/providers/${provider.id}/withdrawals`,
    headers: auth(provider.token),
    payload: { amount_kz: 15000 },
  });
  assert.equal(tooMuch.statusCode, 422);
  assert.equal(tooMuch.json().error.code, "validation");

  const ok = await app.inject({
    method: "POST",
    url: `/providers/${provider.id}/withdrawals`,
    headers: auth(provider.token),
    payload: { amount_kz: 4000 },
  });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.json().data.status, "pending");
  assert.equal(ok.json().data.type, "withdrawal");
  assert.equal(ok.json().data.amount_kz, -4000);

  const [wallet] = await db.select().from(schema.wallets).where(inArray(schema.wallets.providerAccountId, [provider.id]));
  assert.equal(wallet?.balanceKz, 10000);
});

test("ganhos são calculados a partir das transacções da carteira", async () => {
  const provider = await createProvider("ganhos");

  const now = new Date();
  const todayMorning = new Date(now);
  todayMorning.setUTCHours(1, 0, 0, 0);
  const yesterday = new Date(now.getTime() - 86_400_000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000);

  await db.insert(schema.walletTransactions).values([
    { id: newId("tx"), providerAccountId: provider.id, type: "earning", title: "Hoje", amountKz: 5000, status: "completed", createdAt: todayMorning },
    { id: newId("tx"), providerAccountId: provider.id, type: "earning", title: "Ontem", amountKz: 3000, status: "completed", createdAt: yesterday },
    { id: newId("tx"), providerAccountId: provider.id, type: "earning", title: "Há 10 dias", amountKz: 7000, status: "completed", createdAt: tenDaysAgo },
    { id: newId("tx"), providerAccountId: provider.id, type: "earning", title: "Pendente", amountKz: 9000, status: "pending", createdAt: todayMorning },
    { id: newId("tx"), providerAccountId: provider.id, type: "withdrawal", title: "Levantamento", amountKz: -2000, status: "pending", createdAt: todayMorning },
  ]);

  const client = await createClient("ganhos");
  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "delivered" });
  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "paid" });
  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "rated" });
  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "searching" });

  const res = await app.inject({ method: "GET", url: `/providers/${provider.id}/earnings`, headers: auth(provider.token) });
  assert.equal(res.statusCode, 200);
  const body = res.json().data;

  assert.equal(body.today_kz, 5000);
  assert.equal(body.today_count, 1);
  assert.equal(body.week_kz, 5000 + 3000);
  assert.equal(body.completed_count, 3);
  assert.equal(body.last_7_days_kz.length, 7);
  assert.equal(body.last_7_days_kz[6], 5000);
  assert.equal(body.last_7_days_kz.reduce((a: number, b: number) => a + b, 0), 5000 + 3000);
});

test("avaliações vêm dos pedidos classificados", async () => {
  const client = await createClient("avaliacoes");
  const provider = await createProvider("avaliacoes");

  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "rated", rating: 5, review: "Excelente serviço." });
  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "rated", rating: null, review: null });
  await createServiceRequest(client.id, { providerAccountId: provider.id, status: "assigned" });

  const res = await app.inject({ method: "GET", url: `/providers/${provider.id}/reviews`, headers: auth(provider.token) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().data.length, 1);
  assert.equal(res.json().data[0].rating, 5);
  assert.equal(res.json().data[0].comment, "Excelente serviço.");
  assert.equal(res.json().data[0].author_name, `Cliente avaliacoes`);
});

test("GET /zones devolve as zonas para qualquer conta autenticada", async () => {
  const client = await createClient("zonas");
  const zoneId = await createZone("Zona de teste Maianga");

  const res = await app.inject({ method: "GET", url: "/zones", headers: auth(client.token) });
  assert.equal(res.statusCode, 200);
  const zone = res.json().data.find((item: { id: string }) => item.id === zoneId);
  assert.ok(zone);
  assert.equal(zone.name, "Zona de teste Maianga");
  assert.equal(typeof zone.radius_km, "number");
});

test("GET /zones é pública — um candidato a prestador sem sessão também consegue ver as zonas", async () => {
  const zoneId = await createZone("Zona de teste sem sessão");

  const res = await app.inject({ method: "GET", url: "/zones" });
  assert.equal(res.statusCode, 200);
  const zone = res.json().data.find((item: { id: string }) => item.id === zoneId);
  assert.ok(zone);
});

test("um prestador não acede ao estado, cobertura ou carteira de outro", async () => {
  const providerA = await createProvider("acesso-a");
  const providerB = await createProvider("acesso-b");

  const state = await app.inject({ method: "GET", url: `/providers/${providerA.id}/state`, headers: auth(providerB.token) });
  assert.equal(state.statusCode, 403);
  assert.equal(state.json().error.code, "forbidden");

  const availability = await app.inject({
    method: "PUT",
    url: `/providers/${providerA.id}/availability`,
    headers: auth(providerB.token),
    payload: { online: true },
  });
  assert.equal(availability.statusCode, 403);

  const withdrawal = await app.inject({
    method: "POST",
    url: `/providers/${providerA.id}/withdrawals`,
    headers: auth(providerB.token),
    payload: { amount_kz: 100 },
  });
  assert.equal(withdrawal.statusCode, 403);
});
