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

function testEmail(tag: string) {
  return `teste-contas-${tag}-${randomUUID()}@angoleva.ao`;
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

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

function addressBody() {
  return {
    label: "Casa",
    icon: "home",
    place: { id: "place-1", label: "Talatona", district: "Talatona", city: "Luanda", lat: -8.9167, lng: 13.1833 },
  };
}

async function cleanup() {
  if (accountIds.length > 0) {
    await db.delete(schema.clientPaymentMethods).where(inArray(schema.clientPaymentMethods.clientAccountId, accountIds));
    await db.delete(schema.clientAddresses).where(inArray(schema.clientAddresses.clientAccountId, accountIds));
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

test("lista, cria e remove moradas de um cliente", async () => {
  const client = await createClient("moradas");

  const empty = await app.inject({ method: "GET", url: `/clients/${client.id}/addresses`, headers: auth(client.token) });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.json().data, []);

  const create = await app.inject({
    method: "POST",
    url: `/clients/${client.id}/addresses`,
    headers: auth(client.token),
    payload: addressBody(),
  });
  assert.equal(create.statusCode, 201);
  const created = create.json().data;
  assert.equal(created.label, "Casa");
  assert.equal(created.icon, "home");
  assert.deepEqual(created.place, addressBody().place);

  const list = await app.inject({ method: "GET", url: `/clients/${client.id}/addresses`, headers: auth(client.token) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.length, 1);

  const remove = await app.inject({
    method: "DELETE",
    url: `/clients/${client.id}/addresses/${created.id}`,
    headers: auth(client.token),
  });
  assert.equal(remove.statusCode, 204);

  const listAfter = await app.inject({ method: "GET", url: `/clients/${client.id}/addresses`, headers: auth(client.token) });
  assert.equal(listAfter.json().data.length, 0);
});

test("um cliente não pode remover a morada de outro", async () => {
  const owner = await createClient("dono");
  const intruder = await createClient("intruso");

  const create = await app.inject({
    method: "POST",
    url: `/clients/${owner.id}/addresses`,
    headers: auth(owner.token),
    payload: addressBody(),
  });
  const addressId = create.json().data.id;

  const attempt = await app.inject({
    method: "DELETE",
    url: `/clients/${owner.id}/addresses/${addressId}`,
    headers: auth(intruder.token),
  });
  assert.equal(attempt.statusCode, 403);
  assert.equal(attempt.json().error.code, "forbidden");

  const notFound = await app.inject({
    method: "DELETE",
    url: `/clients/${intruder.id}/addresses/${addressId}`,
    headers: auth(intruder.token),
  });
  assert.equal(notFound.statusCode, 404);
  assert.equal(notFound.json().error.code, "not_found");
});

test("lista e cria métodos de pagamento, o primeiro fica por omissão", async () => {
  const client = await createClient("pagamentos");

  const first = await app.inject({
    method: "POST",
    url: `/clients/${client.id}/payment-methods`,
    headers: auth(client.token),
    payload: { type: "card", last4: "1234" },
  });
  assert.equal(first.statusCode, 201);
  const firstMethod = first.json().data;
  assert.equal(firstMethod.type, "card");
  assert.equal(firstMethod.title, "Cartão");
  assert.equal(firstMethod.detail, "•••• 1234");
  assert.equal(firstMethod.is_default, true);

  const second = await app.inject({
    method: "POST",
    url: `/clients/${client.id}/payment-methods`,
    headers: auth(client.token),
    payload: { type: "card", last4: "5678" },
  });
  assert.equal(second.statusCode, 201);
  const secondMethod = second.json().data;
  assert.equal(secondMethod.is_default, false);

  const list = await app.inject({ method: "GET", url: `/clients/${client.id}/payment-methods`, headers: auth(client.token) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.length, 2);

  const setDefault = await app.inject({
    method: "PUT",
    url: `/clients/${client.id}/payment-methods/default`,
    headers: auth(client.token),
    payload: { payment_method_id: secondMethod.id },
  });
  assert.equal(setDefault.statusCode, 200);
  const updated = setDefault.json().data as Array<{ id: string; is_default: boolean }>;
  assert.equal(updated.find((m) => m.id === secondMethod.id)?.is_default, true);
  assert.equal(updated.find((m) => m.id === firstMethod.id)?.is_default, false);
  assert.equal(updated.filter((m) => m.is_default).length, 1);
});

test("sem autenticação devolve 401", async () => {
  const res = await app.inject({ method: "GET", url: "/clients/acc_qualquer/addresses" });
  assert.equal(res.statusCode, 401);
});

test("client_id de outro cliente no URL devolve forbidden", async () => {
  const client = await createClient("guarda");
  const other = await createClient("outro");

  const res = await app.inject({
    method: "GET",
    url: `/clients/${other.id}/payment-methods`,
    headers: auth(client.token),
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error.code, "forbidden");
});
