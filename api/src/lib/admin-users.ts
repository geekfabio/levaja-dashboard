import type { schema } from "../db/client";
import type { AdminRole } from "./admin-roles";

export type AdminAccount = typeof schema.accounts.$inferSelect;

export function initialsOf(name: string) {
  const parts = name.split(" ").filter((part) => part.length > 2 || part === name);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export function toWireAdminUser(account: AdminAccount, lastLoginAt?: Date | null) {
  return {
    id: account.id,
    name: account.fullName,
    email: account.email,
    initials: initialsOf(account.fullName),
    role: account.adminRole as AdminRole,
    active: account.active,
    created_at: account.createdAt.toISOString(),
    last_login_at: lastLoginAt ? lastLoginAt.toISOString() : undefined,
    two_factor_enabled: account.twoFactorEnabled,
  };
}
