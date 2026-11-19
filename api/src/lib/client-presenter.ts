import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { clientAddresses, clientPaymentMethods, clients, serviceRequests } from "../db/schema/ops";

type ClientRow = typeof clients.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;

export async function presentClient(account: AccountRow, client: ClientRow) {
  const own = await db.select().from(serviceRequests).where(eq(serviceRequests.clientAccountId, account.id));
  const addresses = await db.select().from(clientAddresses).where(eq(clientAddresses.clientAccountId, account.id));
  const methods = await db.select().from(clientPaymentMethods).where(eq(clientPaymentMethods.clientAccountId, account.id));
  const settled = own.filter((row) => row.status === "paid" || row.status === "rated");

  return {
    id: account.id,
    full_name: account.fullName,
    email: account.email,
    phone: account.phone ?? "",
    rating: client.rating !== null ? Number(client.rating) : null,
    avatar_url: client.avatarUrl,
    blocked: client.blocked,
    blocked_reason: client.blockedReason,
    created_at: account.createdAt.toISOString(),
    addresses: addresses.map((row) => row.place),
    payment_methods: methods.map((row) => ({ id: row.id, kind: row.type, label: row.detail ? `${row.title} · ${row.detail}` : row.title, is_default: row.isDefault })),
    requests_count: own.length,
    total_spent_kz: settled.reduce((sum, row) => sum + (row.pricing && typeof row.pricing === "object" ? (row.pricing as { total_kz?: number }).total_kz ?? 0 : 0), 0),
  };
}
