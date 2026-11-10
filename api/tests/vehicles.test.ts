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
import { insertClientAccount } from "./helpers/admin";

let app: FastifyInstance;

const accountIds: string[] = [];

const BASE_LAT = -8.8368;
const BASE_LNG = 13.2343;

function testEmail(tag: string) {
  return `teste-viaturas-${tag}-${randomUUID()}@angoleva.ao`;
}

async function createProvider(
  tag: string,
  options: { online?: boolean; lat?: number; lng?: number; coverageServiceTypes?: string[] } = {},
) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "provider", email, phone: "+244 912 000 000", fullName: `Prestador ${tag}`, active: true });
  await db.insert(schema.providers).values({
    accountId: id,
    online: options.online ?? true,
    lat: options.lat !== undefined ? options.lat.toString() : null,
    lng: options.lng !== undefined ? options.lng.toString() : null,
    coverageServiceTypes: options.coverageServiceTypes ?? [],
  });
  accountIds.push(id);
  const { token } = await signAccessToken({ sub: id, kind: "provider", email });
  return { id, token };
}

function offset(km: number) {
  return km / 111;
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (accountIds.length > 0) {
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("/vehicles/nearby exige autenticação", async () => {
  const res = await app.inject({ method: "GET", url: `/vehicles/nearby?lat=${BASE_LAT}&lng=${BASE_LNG}` });
  assert.equal(res.statusCode, 401);
});

test("só aparecem prestadores online com posição", async () => {
  const client = await insertClientAccount(`online-${randomUUID()}`);
  accountIds.push(client.id);

  const online = await createProvider("online", { lat: BASE_LAT, lng: BASE_LNG, coverageServiceTypes: ["tow"] });
  const offline = await createProvider("offline", { online: false, lat: BASE_LAT, lng: BASE_LNG, coverageServiceTypes: ["tow"] });
  const semPosicao = await createProvider("sem-posicao", { online: true, coverageServiceTypes: ["tow"] });

  const res = await app.inject({
    method: "GET",
    url: `/vehicles/nearby?lat=${BASE_LAT}&lng=${BASE_LNG}`,
    headers: { authorization: `Bearer ${client.token}` },
  });
  assert.equal(res.statusCode, 200);

  const vehicles = res.json().data as Array<{ id: string }>;
  const ids = vehicles.map((vehicle) => vehicle.id);
  assert.ok(ids.includes(online.id));
  assert.ok(!ids.includes(offline.id));
  assert.ok(!ids.includes(semPosicao.id));
});

test("respeita o raio pedido", async () => {
  const client = await insertClientAccount(`raio-${randomUUID()}`);
  accountIds.push(client.id);

  const near = await createProvider("perto", { lat: BASE_LAT, lng: BASE_LNG, coverageServiceTypes: ["cargo"] });
  const far = await createProvider("longe", { lat: BASE_LAT + offset(50), lng: BASE_LNG, coverageServiceTypes: ["cargo"] });

  const res = await app.inject({
    method: "GET",
    url: `/vehicles/nearby?lat=${BASE_LAT}&lng=${BASE_LNG}&radius_km=5`,
    headers: { authorization: `Bearer ${client.token}` },
  });
  assert.equal(res.statusCode, 200);

  const ids = (res.json().data as Array<{ id: string }>).map((vehicle) => vehicle.id);
  assert.ok(ids.includes(near.id));
  assert.ok(!ids.includes(far.id));
});

test("o tipo é inferido a partir da cobertura de serviços", async () => {
  const client = await insertClientAccount(`tipo-${randomUUID()}`);
  accountIds.push(client.id);

  const tow = await createProvider("tipo-tow", { lat: BASE_LAT, lng: BASE_LNG, coverageServiceTypes: ["cargo", "tow"] });
  const cargo = await createProvider("tipo-cargo", { lat: BASE_LAT, lng: BASE_LNG, coverageServiceTypes: ["cargo"] });
  const move = await createProvider("tipo-move", { lat: BASE_LAT, lng: BASE_LNG, coverageServiceTypes: ["small_move"] });

  const res = await app.inject({
    method: "GET",
    url: `/vehicles/nearby?lat=${BASE_LAT}&lng=${BASE_LNG}`,
    headers: { authorization: `Bearer ${client.token}` },
  });
  assert.equal(res.statusCode, 200);

  const vehicles = res.json().data as Array<{ id: string; type: string }>;
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.type]));
  assert.equal(byId.get(tow.id), "tow");
  assert.equal(byId.get(cargo.id), "cargo");
  assert.equal(byId.get(move.id), "move");
});
