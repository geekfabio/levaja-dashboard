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
import { setBankConfirmationMsForTests } from "../src/lib/payments";

let app: FastifyInstance;

const accountIds: string[] = [];
const requestIds: string[] = [];

function testEmail(tag: string) {
  return `teste-pagamentos-${tag}-${randomUUID()}@angoleva.ao`;
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

type Session = { id: string; token: string };

async function createDeliveredRequest(client: Session, provider: Session) {
  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  assert.equal(create.statusCode, 201);
  const reqId = create.json().data.id as string;
  requestIds.push(reqId);

  await app.inject({ method: "POST", url: `/requests/${reqId}/accept`, headers: auth(provider.token), payload: { provider_id: provider.id } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(provider.token), payload: { to: "en_route", actor: "provider" } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(provider.token), payload: { to: "arrived", actor: "provider" } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(client.token), payload: { to: "pickup_confirmed", actor: "client" } });
  await app.inject({ method: "POST", url: `/requests/${reqId}/transitions`, headers: auth(provider.token), payload: { to: "in_transit", actor: "provider" } });
  const proof = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/proof`,
    headers: auth(provider.token),
    payload: { photos: [], signed_by: "Armando Manuel", good_condition: true, notes: null },
  });
  assert.equal(proof.statusCode, 200);
  assert.equal(proof.json().data.status, "delivered");

  return reqId;
}

async function cleanup() {
  const threadIds = [...requestIds, "support-client", "support-provider"].flatMap((id) => accountIds.map((accountId) => `${id}:${accountId}`));
  threadIds.push(...requestIds);

  if (threadIds.length > 0) {
    await db.delete(schema.chatMessages).where(inArray(schema.chatMessages.threadId, threadIds));
    await db.delete(schema.chatThreads).where(inArray(schema.chatThreads.id, threadIds));
  }
  await db.delete(schema.devices).where(inArray(schema.devices.accountId, accountIds));
  if (requestIds.length > 0) {
    await db.delete(schema.payments).where(inArray(schema.payments.requestId, requestIds));
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
  // Demo-only: shrink the simulated bank confirmation delay (normally 5s)
  // so this test suite does not have to sleep for real to see it fire. Kept
  // above the real round-trip time of two sequential requests against the
  // live database, so the "restart with the same method" test still finds
  // the first payment still pending when it runs its second request.
  setBankConfirmationMsForTests(3000);
  app = await buildApp();
});

after(async () => {
  await cleanup();
  await app.close();
});

test("pagamento com cartão confirma de imediato e marca o pedido como pago", async () => {
  const client = await createClient("cartao");
  const provider = await createProvider("cartao");
  const reqId = await createDeliveredRequest(client, provider);

  const pay = await app.inject({ method: "POST", url: `/requests/${reqId}/payments`, headers: auth(client.token), payload: { payment_method: "card" } });
  assert.equal(pay.statusCode, 201);
  const payment = pay.json().data;
  assert.equal(payment.status, "confirmed");
  assert.equal(payment.payment_method, "card");
  assert.ok(payment.confirmed_at);
  assert.equal(payment.bank_reference, null);

  const updated = await app.inject({ method: "GET", url: `/requests/${reqId}`, headers: auth(client.token) });
  assert.equal(updated.json().data.status, "paid");

  const events = await db.select().from(schema.serviceRequestEvents).where(eq(schema.serviceRequestEvents.requestId, reqId));
  const paidEvent = events.find((event) => event.status === "paid");
  assert.ok(paidEvent);
  assert.equal(paidEvent!.actor, "system");
});

test("pagamento antes da entrega é rejeitado (invalid_transition)", async () => {
  const client = await createClient("antes-entrega");
  const provider = await createProvider("antes-entrega");

  const create = await app.inject({ method: "POST", url: "/requests", headers: auth(client.token), payload: createRequestBody(client.id) });
  const reqId = create.json().data.id as string;
  requestIds.push(reqId);
  await app.inject({ method: "POST", url: `/requests/${reqId}/accept`, headers: auth(provider.token), payload: { provider_id: provider.id } });

  const pay = await app.inject({ method: "POST", url: `/requests/${reqId}/payments`, headers: auth(client.token), payload: { payment_method: "cash" } });
  assert.equal(pay.statusCode, 409);
  assert.equal(pay.json().error.code, "invalid_transition");
});

test("referência Multicaixa fica pendente e confirma sozinha passado o tempo simulado", async () => {
  const client = await createClient("referencia");
  const provider = await createProvider("referencia");
  const reqId = await createDeliveredRequest(client, provider);

  const pay = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/payments`,
    headers: auth(client.token),
    payload: { payment_method: "bank_reference" },
  });
  assert.equal(pay.statusCode, 201);
  const payment = pay.json().data;
  assert.equal(payment.status, "pending");
  assert.equal(payment.bank_reference.entity, "00123");
  assert.match(payment.bank_reference.reference, /^\d{9}$/);
  assert.ok(payment.bank_reference.expires_at);

  await new Promise((resolve) => setTimeout(resolve, 3300));

  const after = await app.inject({ method: "GET", url: `/payments/${payment.id}`, headers: auth(client.token) });
  assert.equal(after.statusCode, 200);
  assert.equal(after.json().data.status, "confirmed");
  assert.ok(after.json().data.confirmed_at);

  const updated = await app.inject({ method: "GET", url: `/requests/${reqId}`, headers: auth(client.token) });
  assert.equal(updated.json().data.status, "paid");
});

test("reiniciar o pagamento com o mesmo método devolve o pagamento pendente já existente", async () => {
  const client = await createClient("reiniciar");
  const provider = await createProvider("reiniciar");
  const reqId = await createDeliveredRequest(client, provider);

  const first = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/payments`,
    headers: auth(client.token),
    payload: { payment_method: "bank_reference" },
  });
  assert.equal(first.statusCode, 201);
  const firstPayment = first.json().data;

  const second = await app.inject({
    method: "POST",
    url: `/requests/${reqId}/payments`,
    headers: auth(client.token),
    payload: { payment_method: "bank_reference" },
  });
  assert.equal(second.statusCode, 201);
  assert.equal(second.json().data.id, firstPayment.id);
  assert.equal(second.json().data.bank_reference.reference, firstPayment.bank_reference.reference);

  await new Promise((resolve) => setTimeout(resolve, 3300));
});

test("GET /payments/:id só é acessível pelo cliente do pedido", async () => {
  const client = await createClient("acesso-pagamento");
  const outsider = await createClient("acesso-pagamento-outro");
  const provider = await createProvider("acesso-pagamento");
  const reqId = await createDeliveredRequest(client, provider);

  const pay = await app.inject({ method: "POST", url: `/requests/${reqId}/payments`, headers: auth(client.token), payload: { payment_method: "cash" } });
  const paymentId = pay.json().data.id;

  const forbidden = await app.inject({ method: "GET", url: `/payments/${paymentId}`, headers: auth(outsider.token) });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const providerView = await app.inject({ method: "GET", url: `/payments/${paymentId}`, headers: auth(provider.token) });
  assert.equal(providerView.statusCode, 403);
});

test("chat: cliente e prestador trocam mensagens, marcam como lidas e paginam por changes", async () => {
  const client = await createClient("chat");
  const provider = await createProvider("chat");
  const reqId = await createDeliveredRequest(client, provider);

  const firstPage = await app.inject({ method: "GET", url: `/threads/${reqId}/messages`, headers: auth(client.token) });
  assert.equal(firstPage.statusCode, 200);
  assert.deepEqual(firstPage.json().data, []);

  const changesStart = await app.inject({ method: "GET", url: `/threads/${reqId}/changes`, headers: auth(client.token) });
  assert.equal(changesStart.statusCode, 200);
  assert.deepEqual(changesStart.json().data, []);
  const cursor = changesStart.json().meta.cursor;

  const sendFromClient = await app.inject({
    method: "POST",
    url: `/threads/${reqId}/messages`,
    headers: auth(client.token),
    payload: { sender: "client", body: "Estou a chegar." },
  });
  assert.equal(sendFromClient.statusCode, 201);
  assert.equal(sendFromClient.json().data.thread_id, reqId);
  assert.equal(sendFromClient.json().data.read, false);

  const sendFromProvider = await app.inject({
    method: "POST",
    url: `/threads/${reqId}/messages`,
    headers: auth(provider.token),
    payload: { sender: "provider", body: "Certo, aguardo." },
  });
  assert.equal(sendFromProvider.statusCode, 201);

  const messages = await app.inject({ method: "GET", url: `/threads/${reqId}/messages`, headers: auth(client.token) });
  assert.equal(messages.json().data.length, 2);
  assert.equal(messages.json().data[0].body, "Estou a chegar.");

  const changes = await app.inject({ method: "GET", url: `/threads/${reqId}/changes?since=${encodeURIComponent(cursor)}`, headers: auth(provider.token) });
  assert.equal(changes.json().data.length, 2);

  const markRead = await app.inject({ method: "POST", url: `/threads/${reqId}/read`, headers: auth(provider.token), payload: { reader: "provider" } });
  assert.equal(markRead.statusCode, 204);

  const afterRead = await app.inject({ method: "GET", url: `/threads/${reqId}/messages`, headers: auth(provider.token) });
  const clientMessage = afterRead.json().data.find((message: { body: string }) => message.body === "Estou a chegar.");
  assert.equal(clientMessage.read, true);
  const providerMessage = afterRead.json().data.find((message: { body: string }) => message.body === "Certo, aguardo.");
  assert.equal(providerMessage.read, false);
});

test("chat: quem não é parte da conversa não acede, e o sender tem de ser o próprio", async () => {
  const client = await createClient("chat-acesso");
  const provider = await createProvider("chat-acesso");
  const outsider = await createProvider("chat-acesso-fora");
  const reqId = await createDeliveredRequest(client, provider);

  const outsiderView = await app.inject({ method: "GET", url: `/threads/${reqId}/messages`, headers: auth(outsider.token) });
  assert.equal(outsiderView.statusCode, 403);
  assert.equal(outsiderView.json().error.code, "forbidden");

  const outsiderSend = await app.inject({
    method: "POST",
    url: `/threads/${reqId}/messages`,
    headers: auth(outsider.token),
    payload: { sender: "provider", body: "Intrometido." },
  });
  assert.equal(outsiderSend.statusCode, 403);

  const impersonate = await app.inject({
    method: "POST",
    url: `/threads/${reqId}/messages`,
    headers: auth(client.token),
    payload: { sender: "provider", body: "A fingir ser o prestador." },
  });
  assert.equal(impersonate.statusCode, 403);
});

test("chat: as conversas de suporte são isoladas por conta", async () => {
  const clientA = await createClient("suporte-a");
  const clientB = await createClient("suporte-b");

  const sendA = await app.inject({
    method: "POST",
    url: "/threads/support-client/messages",
    headers: auth(clientA.token),
    payload: { sender: "client", body: "Preciso de ajuda com um pedido." },
  });
  assert.equal(sendA.statusCode, 201);
  assert.equal(sendA.json().data.thread_id, "support-client");

  const viewA = await app.inject({ method: "GET", url: "/threads/support-client/messages", headers: auth(clientA.token) });
  assert.equal(viewA.json().data.length, 1);

  const viewB = await app.inject({ method: "GET", url: "/threads/support-client/messages", headers: auth(clientB.token) });
  assert.equal(viewB.statusCode, 200);
  assert.deepEqual(viewB.json().data, []);
});

test("dispositivos: registo e remoção, e remoção por outra conta é forbidden", async () => {
  const owner = await createClient("dispositivo");
  const other = await createClient("dispositivo-outro");
  const pushToken = `ExponentPushToken[${randomUUID()}]`;

  const register = await app.inject({
    method: "POST",
    url: "/devices",
    headers: auth(owner.token),
    payload: { push_token: pushToken, platform: "android", role: "client" },
  });
  assert.equal(register.statusCode, 204);

  const [row] = await db.select().from(schema.devices).where(eq(schema.devices.pushToken, pushToken));
  assert.equal(row?.accountId, owner.id);
  assert.equal(row?.platform, "android");

  const removeByOther = await app.inject({ method: "DELETE", url: `/devices/${encodeURIComponent(pushToken)}`, headers: auth(other.token) });
  assert.equal(removeByOther.statusCode, 403);
  assert.equal(removeByOther.json().error.code, "forbidden");

  const removeByOwner = await app.inject({ method: "DELETE", url: `/devices/${encodeURIComponent(pushToken)}`, headers: auth(owner.token) });
  assert.equal(removeByOwner.statusCode, 204);

  const [gone] = await db.select().from(schema.devices).where(eq(schema.devices.pushToken, pushToken));
  assert.equal(gone, undefined);
});

test("dispositivos: remover um token inexistente devolve not_found", async () => {
  const owner = await createClient("dispositivo-inexistente");
  const remove = await app.inject({ method: "DELETE", url: `/devices/${encodeURIComponent("nunca-registado")}`, headers: auth(owner.token) });
  assert.equal(remove.statusCode, 404);
  assert.equal(remove.json().error.code, "not_found");
});
