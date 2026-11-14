import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { insertClientAccount, insertProviderAccount, placeFixture } from "./helpers/admin";

let app: FastifyInstance;

const providerAccountIds: string[] = [];
const clientAccountIds: string[] = [];
const requestIds: string[] = [];

type Frame = { type: string; topic?: string; code?: string; data?: { id?: string; status?: string; online?: boolean } };
type Socket = Awaited<ReturnType<FastifyInstance["injectWS"]>>;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (requestIds.length > 0) {
    await db.delete(schema.serviceRequestEvents).where(inArray(schema.serviceRequestEvents.requestId, requestIds));
    await db.delete(schema.serviceRequests).where(inArray(schema.serviceRequests.id, requestIds));
  }
  if (providerAccountIds.length > 0) await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  if (clientAccountIds.length > 0) await db.delete(schema.clients).where(inArray(schema.clients.accountId, clientAccountIds));
  const allAccounts = [...providerAccountIds, ...clientAccountIds];
  if (allAccounts.length > 0) await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  await app.close();
});

/** Collects the frames the server sends and lets a test wait for the one it expects. */
function listen(socket: Socket) {
  const frames: Frame[] = [];
  const waiters: { match: (frame: Frame) => boolean; resolve: (frame: Frame) => void }[] = [];
  socket.on("message", (data: { toString(): string }) => {
    const frame = JSON.parse(data.toString()) as Frame;
    frames.push(frame);
    for (const waiter of [...waiters]) {
      if (waiter.match(frame)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(frame);
      }
    }
  });
  return {
    frames,
    next(match: (frame: Frame) => boolean, timeoutMs = 15_000) {
      const seen = frames.find(match);
      if (seen) return Promise.resolve(seen);
      return new Promise<Frame>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Nenhuma mensagem do tempo real a tempo.")), timeoutMs);
        waiters.push({
          match,
          resolve: (frame) => {
            clearTimeout(timer);
            resolve(frame);
          },
        });
      });
    },
  };
}

function send(socket: Socket, frame: Record<string, unknown>) {
  socket.send(JSON.stringify(frame));
}

/** A ping answered means every frame sent before it has been handled (frames are processed in order). */
async function settled(socket: Socket, inbox: ReturnType<typeof listen>) {
  const before = inbox.frames.filter((frame) => frame.type === "pong").length;
  send(socket, { type: "ping" });
  await inbox.next(() => inbox.frames.filter((frame) => frame.type === "pong").length > before);
}

test("sem autenticação não se subscreve; token inválido fecha a ligação", async () => {
  const socket = await app.injectWS("/realtime");
  const inbox = listen(socket);
  send(socket, { type: "subscribe", topic: "requests" });
  assert.equal((await inbox.next((frame) => frame.type === "error")).code, "unauthorized");

  const closed = new Promise((resolve) => socket.on("close", resolve));
  send(socket, { type: "auth", token: "nao-e-um-token" });
  await closed;
});

test("o cliente recebe o seu pedido quando o estado muda; pedidos de outros não chegam", async () => {
  const client = await insertClientAccount("realtime-owner");
  const other = await insertClientAccount("realtime-other");
  clientAccountIds.push(client.id, other.id);

  const place = placeFixture("plc-realtime", -8.83, 13.24);
  const created = await app.inject({
    method: "POST",
    url: "/requests",
    headers: { authorization: `Bearer ${client.token}` },
    payload: { service_type: "tow", client_id: client.id, pickup: place, dropoff: placeFixture("plc-realtime-b", -8.9, 13.19), payment_method: "cash" },
  });
  assert.equal(created.statusCode, 201);
  const requestId = created.json().data.id as string;
  requestIds.push(requestId);

  const mine = await app.injectWS("/realtime");
  const theirs = await app.injectWS("/realtime");
  const myInbox = listen(mine);
  const theirInbox = listen(theirs);
  send(mine, { type: "auth", token: client.token });
  send(mine, { type: "subscribe", topic: "requests" });
  send(theirs, { type: "auth", token: other.token });
  send(theirs, { type: "subscribe", topic: "requests" });
  await settled(mine, myInbox);
  await settled(theirs, theirInbox);

  const cancel = await app.inject({ method: "POST", url: `/requests/${requestId}/cancel`, headers: { authorization: `Bearer ${client.token}` }, payload: { reason: "Teste" } });
  assert.equal(cancel.statusCode, 200);

  const event = await myInbox.next((frame) => frame.type === "event" && frame.topic === "requests" && frame.data?.id === requestId);
  assert.equal(event.data?.status, "cancelled");

  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(theirInbox.frames.some((frame) => frame.type === "event"), false);

  mine.terminate();
  theirs.terminate();
});

test("providers/<id> só do próprio, e avisa quando a disponibilidade muda", async () => {
  const provider = await insertProviderAccount("realtime-self", { online: false });
  const stranger = await insertProviderAccount("realtime-stranger");
  providerAccountIds.push(provider.id, stranger.id);

  const socket = await app.injectWS("/realtime");
  const inbox = listen(socket);
  send(socket, { type: "auth", token: provider.token });
  send(socket, { type: "subscribe", topic: `providers/${stranger.id}` });
  assert.equal((await inbox.next((frame) => frame.type === "error")).code, "forbidden");

  send(socket, { type: "subscribe", topic: `providers/${provider.id}` });
  await settled(socket, inbox);

  const online = await app.inject({ method: "PUT", url: `/providers/${provider.id}/availability`, headers: { authorization: `Bearer ${provider.token}` }, payload: { online: true } });
  assert.equal(online.statusCode, 204);

  const event = await inbox.next((frame) => frame.type === "event" && frame.topic === `providers/${provider.id}`);
  assert.equal(event.data?.online, true);
  socket.terminate();
});
