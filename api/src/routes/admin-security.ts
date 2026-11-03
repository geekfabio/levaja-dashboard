import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts, adminSessions } from "../db/schema/auth";
import { adminAccessLog } from "../db/schema/admin";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { recordAdminAudit } from "../lib/admin-audit";
import { recordAdminAccess, type AdminAccessResult } from "../lib/admin-access-log";
import { toWireAdminUser } from "../lib/admin-users";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";

const reasonBodySchema = z.object({ reason: z.string().optional() });
const twoFactorBodySchema = z.object({ enabled: z.boolean(), reason: z.string().optional() });

const ACCESS_RESULTS: readonly AdminAccessResult[] = ["success", "wrong_code", "two_factor_failed", "inactive", "logout", "revoked"];

const accessLogQuerySchema = pageQuerySchema.extend({
  result: z.string().optional(),
  q: z.string().optional(),
});

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

export async function adminSecurityRoutes(app: FastifyInstance) {
  app.get("/admin/security/sessions", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "security.manage");
    const currentSessionId = request.adminSession!.id;

    const rows = await db.select().from(adminSessions);
    const live = rows.filter((row) => !row.revokedAt && row.expiresAt.getTime() > Date.now());
    const accountsById = new Map((await db.select().from(accounts).where(inArray(accounts.id, live.map((row) => row.accountId)))).map((row) => [row.id, row]));

    const items = live
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => ({
        id: row.id,
        user_id: row.accountId,
        user_name: accountsById.get(row.accountId)?.fullName ?? "",
        role: accountsById.get(row.accountId)?.adminRole ?? null,
        ip: row.ip,
        user_agent: row.userAgent,
        created_at: row.createdAt.toISOString(),
        expires_at: row.expiresAt.toISOString(),
        current: row.id === currentSessionId,
      }));

    return dataEnvelope(items);
  });

  app.post("/admin/security/sessions/:id/revoke", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "security.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason);

    const [session] = await db.select().from(adminSessions).where(eq(adminSessions.id, id)).limit(1);
    if (!session) throw apiError("not_found", "Sessão não encontrada.");
    if (session.id === request.adminSession!.id) {
      throw apiError("validation", "Para terminar a sua própria sessão use «Terminar sessão».");
    }
    if (session.revokedAt) throw apiError("invalid_transition", "A sessão já foi terminada.");

    await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.id, id));

    const [owner] = await db.select().from(accounts).where(eq(accounts.id, session.accountId)).limit(1);
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "security.session_revoke",
      targetModule: "security",
      targetId: session.id,
      targetLabel: owner?.fullName ?? session.accountId,
      reason,
      sensitive: true,
    });
    await recordAdminAccess({
      accountId: owner?.id ?? session.accountId,
      email: owner?.email ?? "",
      userName: owner?.fullName ?? null,
      result: "revoked",
      ip: session.ip,
      device: session.userAgent,
    });

    return dataEnvelope(null);
  });

  app.get("/admin/security/access-log", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "security.manage");
    const query = accessLogQuerySchema.parse(request.query);
    const resultFilter = csvList(query.result)?.filter((item): item is AdminAccessResult => (ACCESS_RESULTS as readonly string[]).includes(item));

    const rows = await db.select().from(adminAccessLog);
    const presented = rows
      .filter((row) => !resultFilter?.length || resultFilter.includes(row.result as AdminAccessResult))
      .filter((row) => matchesText(query.q, row.email, row.userName, row.ip))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((row) => ({
        id: row.id,
        at: row.at.toISOString(),
        email: row.email,
        user_name: row.userName,
        result: row.result,
        ip: row.ip,
        device: row.device,
      }));

    return listPageEnvelope(paginate(presented, query));
  });

  app.post("/admin/security/users/:id/two-factor", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "security.manage");
    const { id } = request.params as { id: string };
    const body = twoFactorBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo");

    const [user] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.kind, "admin"))).limit(1);
    if (!user) throw apiError("not_found", "Utilizador não encontrado.");
    if (user.twoFactorEnabled === body.enabled) {
      throw apiError("invalid_transition", body.enabled ? "O segundo factor já está activo." : "O segundo factor já está desligado.");
    }

    const [updated] = await db
      .update(accounts)
      .set({ twoFactorEnabled: body.enabled, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível actualizar o utilizador.");

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "security.two_factor",
      targetModule: "admin_user",
      targetId: updated.id,
      targetLabel: updated.fullName,
      reason,
      sensitive: true,
      changes: [{ field: "Segundo factor", from: body.enabled ? "Desligado" : "Activo", to: body.enabled ? "Activo" : "Desligado" }],
    });

    return dataEnvelope(toWireAdminUser(updated));
  });
}
