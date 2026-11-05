import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { reverseGeocode, searchPlaces } from "../src/lib/geocoding";
import type { FetchImpl } from "../src/lib/geocoding";
import { insertClientAccount } from "./helpers/admin";

let app: FastifyInstance;

const accountIds: string[] = [];
const zoneIds: string[] = [];

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as unknown as Response);
}

function fakeFetch(body: unknown, ok = true): FetchImpl {
  return (() => jsonResponse(body, ok)) as FetchImpl;
}

function rejectingFetch(): FetchImpl {
  return (() => Promise.reject(new Error("falha de rede"))) as FetchImpl;
}

async function createZone(name: string) {
  const id = newId("zone");
  await db.insert(schema.zones).values({ id, name, lat: "-8.8256", lng: "13.2311", radiusKm: "12.00" });
  zoneIds.push(id);
  return id;
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (zoneIds.length > 0) {
    await db.delete(schema.zones).where(inArray(schema.zones.id, zoneIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.clients).where(inArray(schema.clients.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("as rotas de localização exigem autenticação", async () => {
  const current = await app.inject({ method: "GET", url: "/locations/current" });
  assert.equal(current.statusCode, 401);

  const reverse = await app.inject({ method: "GET", url: "/locations/reverse?lat=-8.83&lng=13.23" });
  assert.equal(reverse.statusCode, 401);

  const search = await app.inject({ method: "GET", url: "/locations/search?q=Maianga" });
  assert.equal(search.statusCode, 401);

  const areas = await app.inject({ method: "GET", url: "/locations/areas" });
  assert.equal(areas.statusCode, 401);
});

test("/locations/current devolve um ponto fixo em Luanda", async () => {
  const client = await insertClientAccount(`current-${randomUUID()}`);
  accountIds.push(client.id);

  const res = await app.inject({ method: "GET", url: "/locations/current", headers: { authorization: `Bearer ${client.token}` } });
  assert.equal(res.statusCode, 200);

  const place = res.json().data;
  assert.equal(place.city, "Luanda");
  assert.equal(typeof place.lat, "number");
  assert.equal(typeof place.lng, "number");
});

test("/locations/areas devolve as zonas existentes", async () => {
  const client = await insertClientAccount(`areas-${randomUUID()}`);
  accountIds.push(client.id);
  const zoneId = await createZone(`Zona de teste ${randomUUID().slice(0, 6)}`);

  const res = await app.inject({ method: "GET", url: "/locations/areas", headers: { authorization: `Bearer ${client.token}` } });
  assert.equal(res.statusCode, 200);

  const places = res.json().data as Array<{ id: string; city: string }>;
  assert.ok(places.some((place) => place.id === zoneId));
  assert.ok(places.every((place) => place.city === "Luanda"));
});

test("reverseGeocode mapeia a resposta do Nominatim", async () => {
  const fake = fakeFetch({
    place_id: 123456,
    lat: "-8.8368",
    lon: "13.2343",
    display_name: "Rua de Luanda, Ingombota, Luanda, Angola",
    address: { suburb: "Ingombota", city: "Luanda" },
  });

  const place = await reverseGeocode(-8.8368, 13.2343, fake);
  assert.equal(place.id, "osm-123456");
  assert.equal(place.district, "Ingombota");
  assert.equal(place.city, "Luanda");
  assert.equal(place.lat, -8.8368);
  assert.equal(place.lng, 13.2343);
});

test("reverseGeocode lança not_found quando o Nominatim falha", async () => {
  await assert.rejects(() => reverseGeocode(-8.8368, 13.2343, rejectingFetch()), (error: { code?: string }) => {
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("searchPlaces mapeia a lista do Nominatim", async () => {
  const fake = fakeFetch([
    {
      place_id: 1,
      lat: "-8.9167",
      lon: "13.1833",
      display_name: "Talatona, Luanda, Angola",
      address: { suburb: "Talatona", city: "Luanda" },
    },
    {
      place_id: 2,
      lat: "-8.8256",
      lon: "13.2311",
      display_name: "Maianga, Luanda, Angola",
      address: { neighbourhood: "Maianga", city: "Luanda" },
    },
  ]);

  const places = await searchPlaces("Talatona", {}, fake);
  assert.equal(places.length, 2);
  assert.equal(places[0]!.district, "Talatona");
  assert.equal(places[1]!.district, "Maianga");
});

test("searchPlaces devolve lista vazia quando não há resultados ou há erro", async () => {
  const emptyResult = await searchPlaces("xyzxyz", {}, fakeFetch([]));
  assert.deepEqual(emptyResult, []);

  const errorResult = await searchPlaces("xyzxyz", {}, rejectingFetch());
  assert.deepEqual(errorResult, []);
});
