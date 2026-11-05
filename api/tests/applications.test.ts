import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const applicationIds: string[] = [];
const providerAccountIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (applicationIds.length > 0) {
    await db.delete(schema.providerApplications).where(inArray(schema.providerApplications.id, applicationIds));
  }
  if (providerAccountIds.length > 0) {
    await db.delete(schema.vehicles).where(inArray(schema.vehicles.providerAccountId, providerAccountIds));
    await db.delete(schema.providers).where(inArray(schema.providers.accountId, providerAccountIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
  }
  const allAccounts = [...adminAccountIds, ...providerAccountIds];
  if (allAccounts.length > 0) {
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, allAccounts));
  }
  await app.close();
});

function applicationEmail(tag: string) {
  return `teste-candidatura-${tag}-${randomUUID()}@angoleva.ao`;
}

function applicationPayload(tag: string, overrides: Record<string, unknown> = {}) {
  return {
    full_name: `Candidato ${tag}`,
    email: applicationEmail(tag),
    phone: "923111222",
    service_types: ["tow", "cargo"],
    zone_ids: ["zone-maianga"],
    vehicle: {
      brand: "Toyota",
      model: "Hilux",
      plate: "LD-11-22-AA",
      color: "Branco",
      class: "pickup",
      category_label: "Pickup média",
      capacity_kg: 1200,
      year: 2020,
    },
    ...overrides,
  };
}

async function createApplication(tag: string, overrides: Record<string, unknown> = {}) {
  const response = await app.inject({ method: "POST", url: "/applications", payload: applicationPayload(tag, overrides) });
  assert.equal(response.statusCode, 201);
  const body = response.json().data as { id: string; status: string };
  applicationIds.push(body.id);
  return body;
}

test("POST /applications cria a candidatura em pending", async () => {
  const created = await createApplication("pending");
  assert.equal(created.status, "pending");
});

test("papel sem permissão não acede a candidaturas (forbidden)", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const session = await createAdminSession(app, supportAdmin.id);

  const list = await app.inject({ method: "GET", url: "/admin/applications", cookies: session.cookies });
  assert.equal(list.statusCode, 403);
  assert.equal(list.json().error.code, "forbidden");
});

test("aprovação exige motivo, cria a conta de prestador e audita; aprovar de novo é invalid_transition", async () => {
  const admin = await insertAdminAccount("operations", "aprova-candidatura");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const application = await createApplication("aprovar");

  const missingReason = await app.inject({
    method: "POST",
    url: `/admin/applications/${application.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(missingReason.statusCode, 422);
  assert.equal(missingReason.json().error.code, "validation");

  const approve = await app.inject({
    method: "POST",
    url: `/admin/applications/${application.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Documentação da candidatura conforme." },
  });
  assert.equal(approve.statusCode, 200);
  const approved = approve.json().data as { status: string; created_provider_account_id: string };
  assert.equal(approved.status, "approved");
  assert.ok(approved.created_provider_account_id);
  providerAccountIds.push(approved.created_provider_account_id);

  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, approved.created_provider_account_id));
  assert.equal(account?.kind, "provider");

  const [providerRow] = await db.select().from(schema.providers).where(eq(schema.providers.accountId, approved.created_provider_account_id));
  assert.equal(providerRow?.accountStatus, "pending_approval");
  assert.deepEqual(providerRow?.coverageZoneIds, ["zone-maianga"]);

  const audit = await db.select().from(schema.adminAuditLog).where(eq(schema.adminAuditLog.targetId, application.id));
  assert.ok(audit.some((row) => row.action === "application.approve"));

  const again = await app.inject({
    method: "POST",
    url: `/admin/applications/${application.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetir aprovação." },
  });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().error.code, "invalid_transition");
});

test("rejeição marca a candidatura como rejected com o motivo", async () => {
  const admin = await insertAdminAccount("admin", "rejeita-candidatura");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const application = await createApplication("rejeitar");

  const reject = await app.inject({
    method: "POST",
    url: `/admin/applications/${application.id}/reject`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Documentos inconsistentes." },
  });
  assert.equal(reject.statusCode, 200);
  const rejected = reject.json().data as { status: string; rejection_reason: string | null };
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejection_reason, "Documentos inconsistentes.");
});

test("aprovar candidatura com email já usado por um prestador existente é validation", async () => {
  const admin = await insertAdminAccount("admin", "candidatura-duplicada");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const duplicateEmail = applicationEmail("duplicado");
  const existingAccountId = `acc_${randomUUID()}`;
  await db.insert(schema.accounts).values({
    id: existingAccountId,
    kind: "provider",
    email: duplicateEmail,
    phone: "+244 912 000 000",
    fullName: "Prestador existente",
    active: true,
  });
  await db.insert(schema.providers).values({ accountId: existingAccountId });
  providerAccountIds.push(existingAccountId);

  const application = await createApplication("duplicado", { email: duplicateEmail });

  const approve = await app.inject({
    method: "POST",
    url: `/admin/applications/${application.id}/approve`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Tentativa com email duplicado." },
  });
  assert.equal(approve.statusCode, 422);
  assert.equal(approve.json().error.code, "validation");
});
