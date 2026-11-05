import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { rm } from "node:fs/promises";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { UPLOADS_DIR } from "../src/lib/uploads";
import { insertProviderAccount } from "./helpers/admin";
import { buildMultipartBody, ONE_PIXEL_PNG } from "./helpers/multipart";

let app: FastifyInstance;

const providerAccountIds: string[] = [];
const createdUploadIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  for (const id of createdUploadIds) {
    await rm(`${UPLOADS_DIR}/${id}`, { force: true });
    await rm(`${UPLOADS_DIR}/${id}.json`, { force: true });
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, providerAccountIds));
  }
  await app.close();
});

test("envia uma imagem válida e fica acessível pelo url devolvido", async () => {
  const provider = await insertProviderAccount("uploads-ok");
  providerAccountIds.push(provider.id);

  const { body, contentType } = buildMultipartBody(
    [{ name: "context", value: "vehicle" }],
    [{ name: "file", filename: "vehicle.png", contentType: "image/png", content: ONE_PIXEL_PNG }],
  );

  const upload = await app.inject({
    method: "POST",
    url: "/uploads",
    headers: { authorization: `Bearer ${provider.token}`, "content-type": contentType },
    payload: body,
  });

  assert.equal(upload.statusCode, 201);
  const data = upload.json().data as { id: string; url: string; content_type: string };
  assert.ok(data.id);
  assert.equal(data.content_type, "image/png");
  createdUploadIds.push(data.id);

  const fetched = await app.inject({ method: "GET", url: data.url });
  assert.equal(fetched.statusCode, 200);
  assert.equal(fetched.headers["content-type"], "image/png");
  assert.ok(fetched.rawPayload.equals(ONE_PIXEL_PNG));
});

test("ficheiro que não é imagem devolve validation", async () => {
  const provider = await insertProviderAccount("uploads-not-image");
  providerAccountIds.push(provider.id);

  const { body, contentType } = buildMultipartBody(
    [{ name: "context", value: "document" }],
    [{ name: "file", filename: "doc.txt", contentType: "text/plain", content: Buffer.from("não é uma imagem") }],
  );

  const upload = await app.inject({
    method: "POST",
    url: "/uploads",
    headers: { authorization: `Bearer ${provider.token}`, "content-type": contentType },
    payload: body,
  });

  assert.equal(upload.statusCode, 422);
  assert.equal(upload.json().error.code, "validation");
});

test("corpo sem ficheiro devolve validation", async () => {
  const provider = await insertProviderAccount("uploads-no-file");
  providerAccountIds.push(provider.id);

  const { body, contentType } = buildMultipartBody([{ name: "context", value: "document" }], []);

  const upload = await app.inject({
    method: "POST",
    url: "/uploads",
    headers: { authorization: `Bearer ${provider.token}`, "content-type": contentType },
    payload: body,
  });

  assert.equal(upload.statusCode, 422);
  assert.equal(upload.json().error.code, "validation");
});

test("sem autenticação devolve unauthorized", async () => {
  const { body, contentType } = buildMultipartBody(
    [{ name: "context", value: "vehicle" }],
    [{ name: "file", filename: "vehicle.png", contentType: "image/png", content: ONE_PIXEL_PNG }],
  );

  const upload = await app.inject({ method: "POST", url: "/uploads", headers: { "content-type": contentType }, payload: body });
  assert.equal(upload.statusCode, 401);
});

test("ficheiro inexistente devolve not_found", async () => {
  const response = await app.inject({ method: "GET", url: "/uploads/upl_inexistente" });
  assert.equal(response.statusCode, 404);
});
