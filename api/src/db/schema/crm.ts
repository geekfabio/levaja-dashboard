import { boolean, index, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { angoleva } from "./schema";

export const crmCompanies = angoleva.table("crm_companies", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  zone: varchar("zone", { length: 80 }),
  owner: varchar("owner", { length: 120 }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmContacts = angoleva.table(
  "crm_contacts",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => crmCompanies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    role: varchar("role", { length: 80 }),
    phone: varchar("phone", { length: 32 }),
    whatsapp: varchar("whatsapp", { length: 32 }),
    email: varchar("email", { length: 254 }),
    contactability: varchar("contactability", { length: 20 }).notNull().default("Válido"),
    consent: jsonb("consent").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("crm_contacts_company_idx").on(table.companyId)],
);

export const crmOpportunities = angoleva.table(
  "crm_opportunities",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => crmCompanies.id, { onDelete: "cascade" }),
    contactName: varchar("contact_name", { length: 160 }),
    stage: varchar("stage", { length: 40 }).notNull(),
    valueKz: integer("value_kz").notNull().default(0),
    probability: integer("probability").notNull().default(0),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    owner: varchar("owner", { length: 120 }),
    lossReason: varchar("loss_reason", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("crm_opportunities_company_idx").on(table.companyId)],
);

export const crmActivities = angoleva.table(
  "crm_activities",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => crmCompanies.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    owner: varchar("owner", { length: 120 }),
    zone: varchar("zone", { length: 80 }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("crm_activities_company_idx").on(table.companyId)],
);

export const crmTasks = angoleva.table("crm_tasks", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => crmCompanies.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  assignee: varchar("assignee", { length: 120 }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("Por Fazer"),
  notes: text("notes"),
});

export const crmConversations = angoleva.table("crm_conversations", {
  id: text("id").primaryKey(),
  contactId: text("contact_id")
    .notNull()
    .references(() => crmContacts.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 20 }).notNull(),
  unread: integer("unread").notNull().default(0),
});

export const crmConversationMessages = angoleva.table(
  "crm_conversation_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => crmConversations.id, { onDelete: "cascade" }),
    direction: varchar("direction", { length: 10 }).notNull(),
    body: text("body").notNull(),
    author: varchar("author", { length: 120 }),
    status: varchar("status", { length: 20 }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("crm_conversation_messages_conversation_idx").on(table.conversationId)],
);

export const crmDocuments = angoleva.table("crm_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => crmCompanies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  mime: varchar("mime", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  url: text("url"),
  removed: boolean("removed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmTickets = angoleva.table("crm_tickets", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => crmCompanies.id),
  subject: varchar("subject", { length: 200 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("Aberto"),
  priority: varchar("priority", { length: 20 }),
  owner: varchar("owner", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmCampaigns = angoleva.table("crm_campaigns", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("Rascunho"),
  templateId: varchar("template_id", { length: 80 }),
  content: jsonb("content").notNull().default({}),
  audience: jsonb("audience").notNull().default({}),
  recipients: integer("recipients").notNull().default(0),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  testSentAt: timestamp("test_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmAutomations = angoleva.table("crm_automations", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("Rascunho"),
  trigger: jsonb("trigger").notNull().default({}),
  conditions: jsonb("conditions").notNull().default({}),
  steps: jsonb("steps").notNull().default([]),
  enrolled: integer("enrolled").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crmDiscountOffers = angoleva.table("crm_discount_offers", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => crmCompanies.id, { onDelete: "cascade" }),
  percent: integer("percent").notNull(),
  scope: varchar("scope", { length: 40 }).notNull(),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default("Por apresentar"),
  origin: varchar("origin", { length: 80 }),
  owner: varchar("owner", { length: 120 }),
  automationId: text("automation_id").references(() => crmAutomations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
});

export const crmAuditLog = angoleva.table("crm_audit_log", {
  id: text("id").primaryKey(),
  actorAccountId: text("actor_account_id").references(() => accounts.id),
  action: varchar("action", { length: 200 }).notNull(),
  targetModule: varchar("target_module", { length: 80 }),
  targetId: text("target_id"),
  targetLabel: varchar("target_label", { length: 160 }),
  companyId: text("company_id"),
  sensitive: boolean("sensitive").notNull().default(false),
  changes: jsonb("changes").$type<unknown[]>().notNull().default([]),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
