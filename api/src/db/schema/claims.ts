import { index, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { serviceRequests } from "./ops";
import { angoleva } from "./schema";

export const claimKindEnum = angoleva.enum("claim_kind", ["cargo_damage", "vehicle_damage", "accident", "theft", "injury"]);

export const claimStatusEnum = angoleva.enum("claim_status", ["reported", "under_review", "approved", "rejected", "paid"]);

export const claims = angoleva.table(
  "claims",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    kind: claimKindEnum("kind").notNull(),
    description: text("description").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    reportedByAccountId: text("reported_by_account_id")
      .notNull()
      .references(() => accounts.id),
    estimatedAmountKz: integer("estimated_amount_kz").notNull(),
    status: claimStatusEnum("status").notNull().default("reported"),
    insurer: varchar("insurer", { length: 120 }),
    policyNumber: varchar("policy_number", { length: 60 }),
    approvedAmountKz: integer("approved_amount_kz"),
    decisionReason: text("decision_reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByAccountId: text("decided_by_account_id").references(() => accounts.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 120 }),
    notes: jsonb("notes").$type<{ id: string; author: string; text: string; at: string }[]>().notNull().default([]),
    photoIds: jsonb("photo_ids").$type<string[]>().notNull().default([]),
  },
  (table) => [index("claims_request_idx").on(table.requestId), index("claims_status_idx").on(table.status)],
);
