import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { adminAuditLog } from "../db/schema/admin";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { requirePermission } from "../lib/require-permission";

const listQuerySchema = pageQuerySchema.extend({
  actor_id: z.string().optional(),
  entity_kind: z.string().optional(),
  action: z.string().optional(),
  entity_id: z.string().optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

function csv(value: string | undefined) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

export async function adminAuditRoutes(app: FastifyInstance) {
  app.get("/admin/audit", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "audit.view");
    const query = listQuerySchema.parse(request.query);

    const entityKindFilter = csv(query.entity_kind);
    const actionFilter = csv(query.action);

    const rows = await db.select().from(adminAuditLog);
    const actorsById = new Map((await db.select().from(accounts).where(inArray(accounts.id, rows.map((row) => row.actorAccountId)))).map((row) => [row.id, row]));

    const filtered = rows.filter((row) => {
      if (query.actor_id && row.actorAccountId !== query.actor_id) return false;
      if (entityKindFilter?.length && !(row.targetModule && entityKindFilter.includes(row.targetModule))) return false;
      if (actionFilter?.length && !actionFilter.includes(row.action)) return false;
      if (query.entity_id && row.targetId !== query.entity_id) return false;
      if (query.from && row.at.toISOString() < query.from) return false;
      if (query.to && row.at.toISOString() > query.to) return false;
      return true;
    });

    const presented = filtered
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((row) => ({
        id: row.id,
        actor_id: row.actorAccountId,
        actor_name: actorsById.get(row.actorAccountId)?.fullName ?? "",
        actor_role: actorsById.get(row.actorAccountId)?.adminRole ?? null,
        action: row.action,
        entity: { kind: row.targetModule, id: row.targetId, label: row.targetLabel },
        reason: row.reason,
        changes: row.changes,
        sensitive: row.sensitive,
        at: row.at.toISOString(),
      }))
      .filter((item) => matchesText(query.q, item.entity.label, item.reason, item.actor_name));

    return listPageEnvelope(paginate(presented, query));
  });
}
