import { index, integer, numeric, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { clients } from "./ops";
import { angoleva } from "./schema";

export const businessStatusEnum = angoleva.enum("business_status", ["active", "suspended"]);

export const businessAccounts = angoleva.table("business_accounts", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  nif: varchar("nif", { length: 20 }).notNull().unique(),
  sector: varchar("sector", { length: 120 }).notNull(),
  contactName: varchar("contact_name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  status: businessStatusEnum("status").notNull().default("active"),
  suspensionReason: text("suspension_reason"),
  contractStartsAt: timestamp("contract_starts_at", { withTimezone: true }).notNull(),
  contractEndsAt: timestamp("contract_ends_at", { withTimezone: true }).notNull(),
  contractDiscountRate: numeric("contract_discount_rate", { precision: 5, scale: 4 }).notNull(),
  contractPaymentTermsDays: integer("contract_payment_terms_days").notNull(),
  contractCreditLimitKz: integer("contract_credit_limit_kz").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessMembers = angoleva.table(
  "business_members",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessAccounts.id, { onDelete: "cascade" }),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clients.accountId, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("business_members_business_idx").on(table.businessId), uniqueIndex("business_members_client_unique").on(table.clientAccountId)],
);

export const businessStatements = angoleva.table(
  "business_statements",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessAccounts.id, { onDelete: "cascade" }),
    month: varchar("month", { length: 7 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    reference: varchar("reference", { length: 120 }).notNull(),
  },
  (table) => [uniqueIndex("business_statements_business_month_unique").on(table.businessId, table.month)],
);
