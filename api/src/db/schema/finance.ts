import { index, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { providers } from "./ops";
import { angoleva } from "./schema";

export const withdrawalStatusEnum = angoleva.enum("withdrawal_status", ["pending", "approved", "rejected", "paid"]);

export const payoutBatchStatusEnum = angoleva.enum("payout_batch_status", ["draft", "sent", "paid", "cancelled"]);

export const settlementMethodEnum = angoleva.enum("settlement_method", ["card", "bank_reference"]);

export const payoutBatches = angoleva.table("payout_batches", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  status: payoutBatchStatusEnum("status").notNull().default("draft"),
  totalKz: integer("total_kz").notNull(),
  count: integer("count").notNull(),
  createdByAccountId: text("created_by_account_id").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  bankReference: text("bank_reference"),
  cancelReason: text("cancel_reason"),
});

export const withdrawals = angoleva.table(
  "withdrawals",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id")
      .notNull()
      .references(() => providers.accountId, { onDelete: "cascade" }),
    amountKz: integer("amount_kz").notNull(),
    iban: varchar("iban", { length: 40 }).notNull(),
    status: withdrawalStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByAccountId: text("decided_by_account_id").references(() => accounts.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: text("payment_reference"),
    reason: text("reason"),
    batchId: text("batch_id").references(() => payoutBatches.id),
  },
  (table) => [index("withdrawals_provider_idx").on(table.providerAccountId), index("withdrawals_batch_idx").on(table.batchId)],
);

export const settlementRecords = angoleva.table(
  "settlement_records",
  {
    id: text("id").primaryKey(),
    day: varchar("day", { length: 10 }).notNull(),
    method: settlementMethodEnum("method").notNull(),
    received: integer("received"),
    reference: text("reference"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    resolution: text("resolution"),
    resolvedByAccountId: text("resolved_by_account_id").references(() => accounts.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("settlement_records_day_idx").on(table.day)],
);

export const cashDeposits = angoleva.table(
  "cash_deposits",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id")
      .notNull()
      .references(() => providers.accountId, { onDelete: "cascade" }),
    amountKz: integer("amount_kz").notNull(),
    reference: text("reference").notNull(),
    recordedByAccountId: text("recorded_by_account_id").references(() => accounts.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cash_deposits_provider_idx").on(table.providerAccountId)],
);
