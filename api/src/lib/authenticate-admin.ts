import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { apiError } from "./envelope";

export const ADMIN_SESSION_COOKIE = "admin_session";

export type AdminAccountRow = typeof schema.accounts.$inferSelect;
export type AdminSessionRow = typeof schema.adminSessions.$inferSelect;

declare module "fastify" {
  interface FastifyRequest {
    adminAccount?: AdminAccountRow;
    adminSession?: AdminSessionRow;
  }
}

export async function loadAdminSession(request: FastifyRequest) {
  const raw = request.cookies[ADMIN_SESSION_COOKIE];
  if (!raw) return null;

  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  const [session] = await db.select().from(schema.adminSessions).where(eq(schema.adminSessions.id, unsigned.value)).limit(1);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, session.accountId)).limit(1);
  if (!account || account.kind !== "admin" || !account.adminRole || !account.active) return null;

  return { session, account };
}

export async function authenticateAdmin(request: FastifyRequest, _reply: FastifyReply) {
  const result = await loadAdminSession(request);
  if (!result) {
    throw apiError("unauthorized", "Sessão inválida ou expirada. Inicie sessão novamente.");
  }
  request.adminAccount = result.account;
  request.adminSession = result.session;
}
