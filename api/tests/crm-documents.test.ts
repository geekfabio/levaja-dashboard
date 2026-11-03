import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { newId } from "../src/lib/ids";
import { newCsrfSecret, computeCsrfToken } from "../src/lib/csrf";

let app: FastifyInstance;

const accountIds: string[] = [];
const companyIds: string[] = [];
const documentIds: string[] = [];

async function insertAdminAccount(name = "Sara Neto") {
  const id = newId("acc");
  const email = `teste-crm-documents-${randomUUID()}@angoleva.ao`;
  await db.insert(schema.accounts).values({ id, kind: "admin", email, fullName: name, active: true, adminRole: "admin", passwordHash: null });
  accountIds.push(id);
  return { id, email };
}

async function auth(name?: string) {
  const admin = await insertAdminAccount(name);
  const sessionId = newId("asess");
  const csrfSecret = newCsrfSecret();
  await db.insert(schema.adminSessions).values({ id: sessionId, accountId: admin.id, csrfSecret, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return { admin, cookieValue: app.signCookie(sessionId), csrfToken: computeCsrfToken(csrfSecret) };
}

async function createCompany() {
  const id = `empresa-teste-${randomUUID().slice(0, 8)}`;
  companyIds.push(id);
  await db.insert(schema.crmCompanies).values({ id, name: "Empresa de Teste" });
  return id;
}

function uploadPayload(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyId,
    name: "Contrato de fornecimento 2026.pdf",
    mime: "application/pdf",
    size: 482_000,
    category: "Contrato",
    ...overrides,
  };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (documentIds.length > 0) {
    await db.delete(schema.crmDocuments).where(inArray(schema.crmDocuments.id, documentIds));
  }
  if (companyIds.length > 0) {
    await db.delete(schema.crmCompanies).where(inArray(schema.crmCompanies.id, companyIds));
  }
  if (accountIds.length > 0) {
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, accountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, accountIds));
  }
  await app.close();
});

test("enviar e obter um documento regista o autor", async () => {
  const session = await auth("Sara Neto");
  const companyId = await createCompany();

  const upload = await app.inject({
    method: "POST",
    url: "/crm/documents",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: uploadPayload(companyId),
  });
  assert.equal(upload.statusCode, 201);
  const id = upload.json().data.id;
  documentIds.push(id);
  assert.equal(upload.json().data.uploaded_by, "Sara Neto");
  assert.equal(upload.json().data.company_id, companyId);

  const list = await app.inject({ method: "GET", url: "/crm/documents", cookies: { admin_session: session.cookieValue } });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === id));
});

test("enviar um tipo de ficheiro não suportado falha com validation", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const upload = await app.inject({
    method: "POST",
    url: "/crm/documents",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: uploadPayload(companyId, { mime: "application/zip" }),
  });
  assert.equal(upload.statusCode, 422);
  assert.equal(upload.json().error.code, "validation");
});

test("enviar um ficheiro acima de 10 MB falha com validation", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const upload = await app.inject({
    method: "POST",
    url: "/crm/documents",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: uploadPayload(companyId, { size: 11 * 1024 * 1024 }),
  });
  assert.equal(upload.statusCode, 422);
  assert.equal(upload.json().error.code, "validation");
});

test("remover e restaurar um documento", async () => {
  const session = await auth();
  const companyId = await createCompany();

  const upload = await app.inject({
    method: "POST",
    url: "/crm/documents",
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: uploadPayload(companyId),
  });
  const id = upload.json().data.id;
  documentIds.push(id);

  const remove = await app.inject({
    method: "DELETE",
    url: `/crm/documents/${id}`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
  });
  assert.equal(remove.statusCode, 200);

  const gone = await app.inject({ method: "GET", url: `/crm/documents/${id}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(gone.statusCode, 404);

  const listAfterRemove = await app.inject({ method: "GET", url: "/crm/documents", cookies: { admin_session: session.cookieValue } });
  assert.ok(!listAfterRemove.json().data.some((item: { id: string }) => item.id === id));

  const restore = await app.inject({
    method: "PUT",
    url: `/crm/documents/${id}/restore`,
    cookies: { admin_session: session.cookieValue },
    headers: { "x-csrf-token": session.csrfToken },
    payload: { id, company_id: companyId, name: upload.json().data.name, mime: upload.json().data.mime, size: upload.json().data.size, category: "Contrato" },
  });
  assert.equal(restore.statusCode, 200);

  const restored = await app.inject({ method: "GET", url: `/crm/documents/${id}`, cookies: { admin_session: session.cookieValue } });
  assert.equal(restored.statusCode, 200);
});
