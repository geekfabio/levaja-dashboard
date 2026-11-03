import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts, adminSessions } from "../db/schema/auth";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

const reasonBodySchema = z.object({ reason: z.string().optional() });

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

    return dataEnvelope(null);
  });
}
