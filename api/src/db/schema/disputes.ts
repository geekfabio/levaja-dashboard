import { index, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { serviceRequests } from "./ops";
import { refunds } from "./refunds";
import { angoleva } from "./schema";

export const disputeCategoryEnum = angoleva.enum("dispute_category", [
  "damage",
  "payment",
  "price",
  "no_show",
  "delay",
  "conduct",
  "other",
]);

export const disputeOutcomeEnum = angoleva.enum("dispute_outcome", ["no_refund", "refund_full", "refund_partial"]);

export const disputes = angoleva.table(
  "disputes",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .unique()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    category: disputeCategoryEnum("category"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    openedByAccountId: text("opened_by_account_id").references(() => accounts.id),
    notes: jsonb("notes").$type<{ id: string; author: string; text: string; at: string }[]>().notNull().default([]),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByAccountId: text("resolved_by_account_id").references(() => accounts.id),
    resolution: text("resolution"),
    outcome: disputeOutcomeEnum("outcome"),
    refundId: text("refund_id").references(() => refunds.id),
  },
  (table) => [index("disputes_request_idx").on(table.requestId)],
);
