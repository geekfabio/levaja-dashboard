import { boolean, index, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { clients, serviceRequests } from "./ops";
import { angoleva } from "./schema";

export const promotionKindEnum = angoleva.enum("promotion_kind", ["percent", "fixed"]);

export const promotions = angoleva.table("promotions", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  kind: promotionKindEnum("kind").notNull(),
  value: integer("value").notNull(),
  maxDiscountKz: integer("max_discount_kz"),
  minOrderKz: integer("min_order_kz").notNull().default(0),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  zoneIds: jsonb("zone_ids").$type<string[]>().notNull().default([]),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  budgetKz: integer("budget_kz").notNull(),
  perClientLimit: integer("per_client_limit").notNull().default(1),
  firstOrderOnly: boolean("first_order_only").notNull().default(false),
  paused: boolean("paused").notNull().default(false),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdByAccountId: text("created_by_account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promotionUses = angoleva.table(
  "promotion_uses",
  {
    id: text("id").primaryKey(),
    promotionId: text("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clients.accountId, { onDelete: "cascade" }),
    discountKz: integer("discount_kz").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("promotion_uses_promotion_idx").on(table.promotionId)],
);
