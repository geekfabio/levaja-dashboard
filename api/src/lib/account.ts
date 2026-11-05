import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { clients, providers } from "../db/schema/ops";
import type { AccountKind } from "./jwt";

export type AccountRow = typeof accounts.$inferSelect;

export type ClientResponse = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  rating: number;
  avatar_url: string | null;
};

const DEFAULT_RATING = 5;

export async function loadProfile(accountId: string, kind: AccountKind) {
  if (kind === "provider") {
    const [row] = await db.select().from(providers).where(eq(providers.accountId, accountId)).limit(1);
    return { rating: row?.rating ?? null, avatarUrl: row?.avatarUrl ?? null };
  }
  const [row] = await db.select().from(clients).where(eq(clients.accountId, accountId)).limit(1);
  return { rating: row?.rating ?? null, avatarUrl: row?.avatarUrl ?? null };
}

export async function toClientResponse(account: AccountRow): Promise<ClientResponse> {
  const profile = await loadProfile(account.id, account.kind as AccountKind);
  const rating = profile.rating !== null ? Number(profile.rating) : DEFAULT_RATING;
  return {
    id: account.id,
    full_name: account.fullName,
    email: account.email,
    phone: account.phone ?? "",
    rating,
    avatar_url: profile.avatarUrl,
  };
}

export async function findAccountByEmailAndKind(email: string, kind: AccountKind) {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.email, email.toLowerCase()), eq(accounts.kind, kind)))
    .limit(1);
  return row;
}

export async function findAccountById(id: string) {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return row;
}
