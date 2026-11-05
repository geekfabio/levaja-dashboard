import { boolean, index, inet, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
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

export const adminApiKeys = angoleva.table("admin_api_keys", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  prefix: varchar("prefix", { length: 20 }).notNull(),
  secretHash: text("secret_hash").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByAccountId: text("created_by_account_id")
    .notNull()
    .references(() => accounts.id),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByAccountId: text("revoked_by_account_id").references(() => accounts.id),
  revokeReason: text("revoke_reason"),
});

export const adminWebhooks = angoleva.table("admin_webhooks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  description: varchar("description", { length: 240 }).notNull().default(""),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  secretHash: text("secret_hash").notNull(),
  secretPreview: varchar("secret_preview", { length: 60 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByAccountId: text("created_by_account_id")
    .notNull()
    .references(() => accounts.id),
});

export const adminWebhookDeliveries = angoleva.table(
  "admin_webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => adminWebhooks.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 80 }).notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    status: varchar("status", { length: 10 }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    simulated: boolean("simulated").notNull().default(true),
  },
  (table) => [index("admin_webhook_deliveries_webhook_idx").on(table.webhookId)],
);

export const broadcastChannelEnum = angoleva.enum("broadcast_channel", ["push", "sms", "email"]);
export const broadcastStatusEnum = angoleva.enum("broadcast_status", ["draft", "scheduled", "sent", "cancelled"]);
export const broadcastAudienceKindEnum = angoleva.enum("broadcast_audience_kind", ["clients", "providers"]);
export const broadcastAudienceSegmentEnum = angoleva.enum("broadcast_audience_segment", [
  "all",
  "inactive_30",
  "new_30",
  "online",
  "business",
]);

export const broadcasts = angoleva.table("broadcasts", {
  id: text("id").primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  channel: broadcastChannelEnum("channel").notNull(),
  audienceKind: broadcastAudienceKindEnum("audience_kind").notNull(),
  audienceSegment: broadcastAudienceSegmentEnum("audience_segment").notNull(),
  audienceZoneIds: jsonb("audience_zone_ids").$type<string[]>().notNull().default([]),
  subject: varchar("subject", { length: 200 }),
  message: text("message").notNull(),
  status: broadcastStatusEnum("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipients: integer("recipients"),
  delivered: integer("delivered"),
  failed: integer("failed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByAccountId: text("created_by_account_id")
    .notNull()
    .references(() => accounts.id),
  cancelReason: text("cancel_reason"),
});
