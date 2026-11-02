import { db, schema } from "../db/client";
import { newId } from "./ids";

export type AuditChange = { field: string; from: string; to: string };

export async function recordAdminAudit(options: {
  actorAccountId: string;
  action: string;
  targetModule?: string;
  targetId?: string;
  targetLabel?: string;
  reason?: string | null;
  changes?: AuditChange[];
  sensitive?: boolean;
}) {
  await db.insert(schema.adminAuditLog).values({
    id: newId("aud"),
    actorAccountId: options.actorAccountId,
    action: options.action,
    targetModule: options.targetModule,
    targetId: options.targetId,
    targetLabel: options.targetLabel,
    reason: options.reason ?? undefined,
    changes: options.changes ?? [],
    sensitive: options.sensitive ?? false,
  });
}
