import { boolean, index, inet, integer, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { angoleva } from "./schema";

export const accountKindEnum = angoleva.enum("account_kind", ["client", "provider", "admin"]);

export const adminRoleEnum = angoleva.enum("admin_role", ["admin", "operations", "support", "finance"]);

export const accounts = angoleva.table(
  "accounts",
  {
    id: text("id").primaryKey(),
    kind: accountKindEnum("kind").notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    passwordHash: text("password_hash"),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    adminRole: adminRoleEnum("admin_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("accounts_email_kind_unique").on(table.email, table.kind)],
);

export const refreshTokens = angoleva.table(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedByTokenId: text("replaced_by_token_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("refresh_tokens_account_idx").on(table.accountId)],
);

export const otpPurposeEnum = angoleva.enum("otp_purpose", ["register", "recover", "admin_login"]);

export const otpCodes = angoleva.table(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("otp_codes_email_purpose_idx").on(table.email, table.purpose)],
);

export const adminSessions = angoleva.table(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    csrfSecret: text("csrf_secret").notNull(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_sessions_account_idx").on(table.accountId)],
);

export const devicePlatformEnum = angoleva.enum("device_platform", ["android", "ios", "web"]);

export const devices = angoleva.table(
  "devices",
  {
    pushToken: text("push_token").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: devicePlatformEnum("platform").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("devices_account_idx").on(table.accountId)],
);
