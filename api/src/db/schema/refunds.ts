import { boolean, index, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { serviceRequests } from "./ops";
import { angoleva } from "./schema";

export const refundSourceEnum = angoleva.enum("refund_source", ["dispute", "cancellation", "manual"]);

export const refundStatusEnum = angoleva.enum("refund_status", ["pending", "approved", "rejected", "paid"]);

export const refunds = angoleva.table(
  "refunds",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    amountKz: integer("amount_kz").notNull(),
    reason: text("reason").notNull(),
    source: refundSourceEnum("source").notNull(),
    chargeProvider: boolean("charge_provider").notNull().default(false),
    status: refundStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    requestedByAccountId: text("requested_by_account_id")
      .notNull()
      .references(() => accounts.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByAccountId: text("decided_by_account_id").references(() => accounts.id),
    decisionReason: text("decision_reason"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 120 }),
  },
  (table) => [index("refunds_request_idx").on(table.requestId), index("refunds_status_idx").on(table.status)],
);
