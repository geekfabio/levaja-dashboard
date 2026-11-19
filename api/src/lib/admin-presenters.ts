import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { disputes } from "../db/schema/disputes";
import { serviceRequests, zones } from "../db/schema/ops";
import { nearestZoneId } from "./dispatch";
import { presentServiceRequest } from "./request-presenter";

type DisputeRow = typeof disputes.$inferSelect;
type ServiceRequestRow = typeof serviceRequests.$inferSelect;

export async function accountName(accountId: string | null | undefined) {
  if (!accountId) return undefined;
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return row?.fullName;
}

export async function presentDispute(dispute: DisputeRow) {
  const [openedBy, resolvedBy] = await Promise.all([accountName(dispute.openedByAccountId), accountName(dispute.resolvedByAccountId)]);
  return {
    reason: dispute.reason,
    category: dispute.category,
    opened_at: dispute.openedAt.toISOString(),
    opened_by: openedBy ?? null,
    notes: dispute.notes,
    resolved_at: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
    resolved_by: resolvedBy ?? null,
    resolution: dispute.resolution,
    outcome: dispute.outcome,
    refund_id: dispute.refundId,
  };
}

/** The request as the mobile app sees it, plus what the panel needs: the zone it falls in and its dispute, if any. */
export async function presentAdminRequest(row: ServiceRequestRow) {
  const [base, zoneRows, [dispute]] = await Promise.all([
    presentServiceRequest(row),
    db.select().from(zones),
    db.select().from(disputes).where(eq(disputes.requestId, row.id)).limit(1),
  ]);
  const pickup = row.pickup as { lat: number; lng: number };
  const zoneId = nearestZoneId(
    { lat: pickup.lat, lng: pickup.lng },
    zoneRows.map((zone) => ({ id: zone.id, lat: Number(zone.lat), lng: Number(zone.lng), radiusKm: Number(zone.radiusKm) })),
  );
  return { ...base, zone_id: zoneId, dispute: dispute ? await presentDispute(dispute) : null };
}
