import { index, integer, text, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { providers } from "./ops";
import { angoleva } from "./schema";

export const penaltyKindEnum = angoleva.enum("penalty_kind", ["warning", "fine", "suspension"]);

export const penalties = angoleva.table(
  "penalties",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id")
      .notNull()
      .references(() => providers.accountId, { onDelete: "cascade" }),
    kind: penaltyKindEnum("kind").notNull(),
    reason: text("reason").notNull(),
    amountKz: integer("amount_kz"),
    days: integer("days"),
    until: timestamp("until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByAccountId: text("revoked_by_account_id").references(() => accounts.id),
    revokeReason: text("revoke_reason"),
  },
  (table) => [index("penalties_provider_idx").on(table.providerAccountId)],
);
