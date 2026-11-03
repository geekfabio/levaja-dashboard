import type { providerApplications } from "../db/schema/ops";

type ApplicationRow = typeof providerApplications.$inferSelect;

export function presentApplication(row: ApplicationRow) {
  return {
    id: row.id,
    full_name: row.fullName,
    email: row.email,
    phone: row.phone,
    service_types: row.serviceTypes,
    zone_ids: row.zoneIds,
    vehicle: row.vehicle,
    status: row.status,
    rejection_reason: row.rejectionReason,
    reviewed_by_account_id: row.reviewedByAccountId,
    reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    created_provider_account_id: row.createdProviderAccountId,
    created_at: row.createdAt.toISOString(),
  };
}
