import type { providerApplications } from "../db/schema/ops";

type ApplicationRow = typeof providerApplications.$inferSelect;

const STAGE_BY_STATUS = { pending: "submitted", approved: "approved", rejected: "rejected" } as const;

export function applicationStage(row: Pick<ApplicationRow, "status">) {
  return STAGE_BY_STATUS[row.status as keyof typeof STAGE_BY_STATUS] ?? "submitted";
}

/**
 * Admin panel shape: everything presentApplication sends plus the fields the
 * panel reads. The candidacy has no interview/inspection steps, so it only
 * moves from "submitted" to "approved" or "rejected".
 */
export function presentAdminApplication(row: ApplicationRow) {
  const vehicle = row.vehicle as { brand?: string; model?: string; plate?: string; class?: string } | null;
  const stage = applicationStage(row);
  const submittedAt = row.createdAt.toISOString();
  const history: { stage: string; at: string; by: string; note?: string }[] = [{ stage: "submitted", at: submittedAt, by: "Candidato" }];
  if (row.reviewedAt && stage !== "submitted") {
    history.push({ stage, at: row.reviewedAt.toISOString(), by: "Equipa AngoLeva", ...(row.rejectionReason ? { note: row.rejectionReason } : {}) });
  }
  return {
    ...presentApplication(row),
    code: `CAN-${row.id.slice(-6).toUpperCase()}`,
    name: row.fullName,
    vehicle_class: vehicle?.class ?? "pickup",
    vehicle_label: vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—" : "—",
    plate: vehicle?.plate ?? "—",
    zone_id: row.zoneIds[0] ?? "",
    services: row.serviceTypes,
    source: "app",
    submitted_at: submittedAt,
    stage,
    history,
    documents_received: [] as string[],
    provider_id: row.createdProviderAccountId,
  };
}

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
