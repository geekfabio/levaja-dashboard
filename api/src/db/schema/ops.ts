import { boolean, index, integer, jsonb, numeric, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { angoleva } from "./schema";

export const serviceTypeEnum = angoleva.enum("service_type", ["tow", "cargo", "small_move", "house_move"]);

export const requestStatusEnum = angoleva.enum("request_status", [
  "searching",
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
  "rated",
  "cancelled",
]);

export const paymentMethodEnum = angoleva.enum("payment_method", ["bank_reference", "card", "cash"]);

export const paymentStatusEnum = angoleva.enum("payment_status", ["pending", "confirmed", "failed", "expired"]);

export const documentStatusEnum = angoleva.enum("document_status", ["pending", "verified", "rejected"]);

export const transactionTypeEnum = angoleva.enum("wallet_transaction_type", ["earning", "withdrawal", "adjustment"]);

export const transactionStatusEnum = angoleva.enum("wallet_transaction_status", ["pending", "completed", "failed"]);

export const providerAccountStatusEnum = angoleva.enum("provider_account_status", ["pending_approval", "active", "suspended"]);

export const clients = angoleva.table("clients", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  rating: numeric("rating", { precision: 2, scale: 1 }),
  avatarUrl: text("avatar_url"),
  blocked: boolean("blocked").notNull().default(false),
  blockedReason: text("blocked_reason"),
});

export const providers = angoleva.table("providers", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  rating: numeric("rating", { precision: 2, scale: 1 }),
  reviewsCount: integer("reviews_count").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  avatarUrl: text("avatar_url"),
  online: boolean("online").notNull().default(false),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  coverageZoneIds: jsonb("coverage_zone_ids").$type<string[]>().notNull().default([]),
  coverageServiceTypes: jsonb("coverage_service_types").$type<string[]>().notNull().default([]),
  declinedRequestIds: jsonb("declined_request_ids").$type<string[]>().notNull().default([]),
  accountStatus: providerAccountStatusEnum("account_status").notNull().default("active"),
  suspensionReason: text("suspension_reason"),
});

export const vehicles = angoleva.table("vehicles", {
  id: text("id").primaryKey(),
  providerAccountId: text("provider_account_id")
    .notNull()
    .references(() => providers.accountId, { onDelete: "cascade" }),
  brand: varchar("brand", { length: 80 }).notNull(),
  model: varchar("model", { length: 80 }).notNull(),
  plate: varchar("plate", { length: 20 }).notNull(),
  color: varchar("color", { length: 40 }).notNull(),
  vehicleClass: varchar("vehicle_class", { length: 40 }).notNull(),
  categoryLabel: varchar("category_label", { length: 80 }).notNull(),
  capacityKg: integer("capacity_kg"),
  year: integer("year"),
});

export const zones = angoleva.table("zones", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
  lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
  radiusKm: numeric("radius_km", { precision: 6, scale: 2 }).notNull(),
});

export const providerDocuments = angoleva.table(
  "provider_documents",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id")
      .notNull()
      .references(() => providers.accountId, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    fileUrl: text("file_url"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: documentStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("provider_documents_provider_idx").on(table.providerAccountId)],
);

export const providerApplications = angoleva.table("provider_applications", {
  id: text("id").primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  serviceTypes: jsonb("service_types").$type<string[]>().notNull().default([]),
  zoneIds: jsonb("zone_ids").$type<string[]>().notNull().default([]),
  vehicle: jsonb("vehicle"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  reviewedByAccountId: text("reviewed_by_account_id").references(() => accounts.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdProviderAccountId: text("created_provider_account_id").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = angoleva.table("wallets", {
  providerAccountId: text("provider_account_id")
    .primaryKey()
    .references(() => providers.accountId, { onDelete: "cascade" }),
  balanceKz: integer("balance_kz").notNull().default(0),
  payoutAccount: jsonb("payout_account").$type<{ bank: string; iban: string; holder: string } | null>(),
});

export const walletTransactions = angoleva.table(
  "wallet_transactions",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id")
      .notNull()
      .references(() => providers.accountId, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    amountKz: integer("amount_kz").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    serviceType: serviceTypeEnum("service_type"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("wallet_transactions_provider_idx").on(table.providerAccountId)],
);

export const serviceRequests = angoleva.table(
  "service_requests",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    serviceType: serviceTypeEnum("service_type").notNull(),
    status: requestStatusEnum("status").notNull().default("searching"),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clients.accountId),
    providerAccountId: text("provider_account_id").references(() => providers.accountId),
    pickup: jsonb("pickup").notNull(),
    dropoff: jsonb("dropoff"),
    stops: jsonb("stops").$type<unknown[]>().notNull().default([]),
    distanceKm: numeric("distance_km", { precision: 7, scale: 2 }),
    durationMin: integer("duration_min"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    towDetails: jsonb("tow_details"),
    cargoDetails: jsonb("cargo_details"),
    movingDetails: jsonb("moving_details"),
    photos: jsonb("photos").$type<unknown[]>().notNull().default([]),
    pickupPhotos: jsonb("pickup_photos").$type<unknown[]>().notNull().default([]),
    instructions: text("instructions"),
    pricing: jsonb("pricing"),
    providerEarningKz: integer("provider_earning_kz"),
    proposal: jsonb("proposal"),
    paymentMethod: paymentMethodEnum("payment_method"),
    rating: integer("rating"),
    review: text("review"),
    proof: jsonb("proof"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("service_requests_client_idx").on(table.clientAccountId),
    index("service_requests_provider_idx").on(table.providerAccountId),
    index("service_requests_status_idx").on(table.status),
  ],
);

export const serviceRequestEvents = angoleva.table(
  "service_request_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull(),
    actor: varchar("actor", { length: 20 }).notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("service_request_events_request_idx").on(table.requestId)],
);

export const payments = angoleva.table(
  "payments",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountKz: integer("amount_kz").notNull(),
    bankReference: jsonb("bank_reference").$type<{ entity: string; reference: string; expires_at: string } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [index("payments_request_idx").on(table.requestId)],
);

export const chatThreads = angoleva.table("chat_threads", {
  id: text("id").primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull().default("service"),
  requestId: text("request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
});

export const chatMessages = angoleva.table(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    sender: varchar("sender", { length: 20 }).notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    read: boolean("read").notNull().default(false),
  },
  (table) => [index("chat_messages_thread_idx").on(table.threadId)],
);

export const supportTickets = angoleva.table("support_tickets", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  requestId: text("request_id").references(() => serviceRequests.id),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  reason: varchar("reason", { length: 120 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sosAlerts = angoleva.table("sos_alerts", {
  id: text("id").primaryKey(),
  requestId: text("request_id").references(() => serviceRequests.id),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
  lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emergencyContacts = angoleva.table("emergency_contacts", {
  id: text("id").primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 32 }).notNull(),
});

export const helpArticles = angoleva.table("help_articles", {
  id: text("id").primaryKey(),
  category: varchar("category", { length: 60 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
});

export const clientAddresses = angoleva.table("client_addresses", {
  id: text("id").primaryKey(),
  clientAccountId: text("client_account_id")
    .notNull()
    .references(() => clients.accountId, { onDelete: "cascade" }),
  label: varchar("label", { length: 80 }).notNull(),
  icon: varchar("icon", { length: 20 }).notNull(),
  place: jsonb("place").notNull(),
});

export const clientPaymentMethods = angoleva.table("client_payment_methods", {
  id: text("id").primaryKey(),
  clientAccountId: text("client_account_id")
    .notNull()
    .references(() => clients.accountId, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  title: varchar("title", { length: 80 }).notNull(),
  detail: varchar("detail", { length: 80 }),
  isDefault: boolean("is_default").notNull().default(false),
});
