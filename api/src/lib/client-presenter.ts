import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { clients, serviceRequests } from "../db/schema/ops";

type ClientRow = typeof clients.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;

export async function presentClient(account: AccountRow, client: ClientRow) {
  const own = await db.select().from(serviceRequests).where(eq(serviceRequests.clientAccountId, account.id));
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
    requests_count: own.length,
    total_spent_kz: settled.reduce((sum, row) => sum + (row.pricing && typeof row.pricing === "object" ? (row.pricing as { total_kz?: number }).total_kz ?? 0 : 0), 0),
  };
}
