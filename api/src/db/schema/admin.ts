import { boolean, index, inet, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { angoleva } from "./schema";

export const adminAuditLog = angoleva.table("admin_audit_log", {
  id: text("id").primaryKey(),
  actorAccountId: text("actor_account_id")
    .notNull()
    .references(() => accounts.id),
  action: varchar("action", { length: 160 }).notNull(),
  targetModule: varchar("target_module", { length: 80 }),
  targetId: text("target_id"),
  targetLabel: varchar("target_label", { length: 160 }),
  reason: text("reason"),
  changes: jsonb("changes").$type<unknown[]>().notNull().default([]),
  sensitive: boolean("sensitive").notNull().default(false),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettings = angoleva.table("platform_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedByAccountId: text("updated_by_account_id").references(() => accounts.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAccessResultEnum = angoleva.enum("admin_access_result", [
  "success",
  "wrong_code",
  "two_factor_failed",
  "inactive",
  "logout",
  "revoked",
]);

export const adminAccessLog = angoleva.table(
  "admin_access_log",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => accounts.id),
    email: varchar("email", { length: 254 }).notNull(),
    userName: varchar("user_name", { length: 160 }),
    result: adminAccessResultEnum("result").notNull(),
    ip: inet("ip"),
    device: text("device"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_access_log_account_idx").on(table.accountId), index("admin_access_log_at_idx").on(table.at)],
);

export const privacySubjectKindEnum = angoleva.enum("privacy_subject_kind", ["client", "provider"]);

export const privacyRequestKindEnum = angoleva.enum("privacy_request_kind", [
  "access",
  "rectification",
  "erasure",
  "portability",
  "objection",
]);

export const privacyRequestChannelEnum = angoleva.enum("privacy_request_channel", ["app", "email", "phone"]);

export const privacyRequestStatusEnum = angoleva.enum("privacy_request_status", [
  "received",
  "in_progress",
  "completed",
  "rejected",
]);

export const privacyRequests = angoleva.table(
  "privacy_requests",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    subjectKind: privacySubjectKindEnum("subject_kind").notNull(),
    subjectAccountId: text("subject_account_id")
      .notNull()
      .references(() => accounts.id),
    subjectName: varchar("subject_name", { length: 160 }).notNull(),
    kind: privacyRequestKindEnum("kind").notNull(),
    channel: privacyRequestChannelEnum("channel").notNull(),
    details: text("details").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: privacyRequestStatusEnum("status").notNull().default("received"),
    assigneeAccountId: text("assignee_account_id").references(() => accounts.id),
    resolution: text("resolution"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("privacy_requests_subject_idx").on(table.subjectAccountId), index("privacy_requests_status_idx").on(table.status)],
);

export const pricingRules = angoleva.table("pricing_rules", {
  id: text("id").primaryKey(),
  serviceType: varchar("service_type", { length: 40 }).notNull(),
  zoneId: text("zone_id"),
  baseKz: jsonb("base_kz").notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
