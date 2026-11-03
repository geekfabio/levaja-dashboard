import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../../src/db/client";
import { computeCsrfToken, newCsrfSecret } from "../../src/lib/csrf";
import { newId } from "../../src/lib/ids";
import { signAccessToken } from "../../src/lib/jwt";

export type AdminRoleName = "admin" | "operations" | "support" | "finance";

export function testEmail(tag: string) {
  return `teste-painel-${tag}-${randomUUID()}@angoleva.ao`;
}

export async function insertAdminAccount(role: AdminRoleName, tag = role) {
  const email = testEmail(tag);
  const id = newId("acc");
  await db.insert(schema.accounts).values({
    id,
    kind: "admin",
    email,
    fullName: `Utilizador de Teste ${tag}`,
    active: true,
    adminRole: role,
    passwordHash: null,
  });
  return { id, email };
}

export async function createAdminSession(app: FastifyInstance, accountId: string) {
  const sessionId = newId("asess");
  const csrfSecret = newCsrfSecret();
  await db.insert(schema.adminSessions).values({
    id: sessionId,
    accountId,
    csrfSecret,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
  });
  const cookieValue = app.signCookie(sessionId);
  const csrfToken = computeCsrfToken(csrfSecret);
  return { sessionId, cookieValue, csrfToken, cookies: { admin_session: cookieValue }, headers: { "x-csrf-token": csrfToken } };
}

export async function insertClientAccount(tag: string) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "client", email, phone: "+244 923 000 000", fullName: `Cliente ${tag}`, active: true });
  await db.insert(schema.clients).values({ accountId: id });
  const { token } = await signAccessToken({ sub: id, kind: "client", email });
  return { id, email, token };
}

export async function insertProviderAccount(tag: string, options: { online?: boolean; accountStatus?: "pending_approval" | "active" | "suspended" } = {}) {
  const id = newId("acc");
  const email = testEmail(tag);
  await db.insert(schema.accounts).values({ id, kind: "provider", email, phone: "+244 912 000 000", fullName: `Prestador ${tag}`, active: true });
  await db.insert(schema.providers).values({
    accountId: id,
    online: options.online ?? true,
    accountStatus: options.accountStatus ?? "active",
  });
  const { token } = await signAccessToken({ sub: id, kind: "provider", email });
  return { id, email, token };
}

export function placeFixture(id: string, lat: number, lng: number) {
  return { id, label: id, district: "Maianga", city: "Luanda", lat, lng };
}

export function cleanupAccountIds(ids: string[]) {
  return ids;
}
