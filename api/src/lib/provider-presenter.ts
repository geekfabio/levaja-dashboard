import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { providerDocuments, providers, serviceRequests, vehicles, walletTransactions, wallets } from "../db/schema/ops";
import { PROVIDER_BUSY_STATUSES } from "./request-state";

type ProviderRow = typeof providers.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;

const COMPLETED_STATUSES = ["delivered", "paid", "rated"] as const;

export async function presentProvider(account: AccountRow, provider: ProviderRow) {
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.providerAccountId, provider.accountId)).limit(1);
  const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, provider.accountId)).limit(1);
  const documents = await db.select().from(providerDocuments).where(eq(providerDocuments.providerAccountId, provider.accountId));
  const ownRequests = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, provider.accountId));
  const earnings = await db
    .select()
    .from(walletTransactions)
    .where(and(eq(walletTransactions.providerAccountId, provider.accountId), eq(walletTransactions.type, "earning")));

  const completed = ownRequests.filter((row) => (COMPLETED_STATUSES as readonly string[]).includes(row.status));
  const busyRequest = ownRequests.find((row) => (PROVIDER_BUSY_STATUSES as readonly string[]).includes(row.status));

  return {
    id: account.id,
    full_name: account.fullName,
    email: account.email,
    phone: account.phone ?? "",
    rating: provider.rating !== null ? Number(provider.rating) : null,
    reviews_count: provider.reviewsCount,
    verified: provider.verified,
    avatar_url: provider.avatarUrl,
    availability: provider.online ? "online" : "offline",
    account_status: provider.accountStatus,
    suspension_reason: provider.suspensionReason,
    coords: provider.lat !== null && provider.lng !== null ? { lat: Number(provider.lat), lng: Number(provider.lng) } : null,
    zone_ids: provider.coverageZoneIds,
    services: provider.coverageServiceTypes,
    vehicle: vehicle
      ? {
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate,
          color: vehicle.color,
          class: vehicle.vehicleClass,
          category_label: vehicle.categoryLabel,
          capacity_kg: vehicle.capacityKg,
          year: vehicle.year,
        }
      : null,
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      kind: document.kind,
      file_url: document.fileUrl,
      valid_until: document.validUntil ? document.validUntil.toISOString() : null,
      status: document.status,
    })),
    balance_kz: wallet?.balanceKz ?? 0,
    total_earnings_kz: earnings.reduce((sum, row) => sum + row.amountKz, 0),
    completed_count: completed.length,
    requests_count: ownRequests.length,
    active_request_id: busyRequest?.id ?? null,
    joined_at: account.createdAt.toISOString(),
  };
}

export async function presentProviders(rows: { account: AccountRow; provider: ProviderRow }[]) {
  return Promise.all(rows.map(({ account, provider }) => presentProvider(account, provider)));
}

export async function loadProviderAccounts(accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, AccountRow>();
  const rows = await db.select().from(accounts).where(inArray(accounts.id, accountIds));
  return new Map(rows.map((row) => [row.id, row]));
}
