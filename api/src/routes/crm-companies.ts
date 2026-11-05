import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";

type CompanyRow = typeof schema.crmCompanies.$inferSelect;

const TAGS = [
  "Grossista",
  "Retalho",
  "HORECA",
  "Revendedor",
  "Novo cliente",
  "Venda adicional",
  "Expansão",
  "Renovação",
  "Piloto",
  "Parceria",
  "Reactivação",
] as const;

const PAYMENT_TERMS = ["Pronto pagamento", "Crédito a 15 dias", "Crédito a 30 dias", "Crédito a 60 dias"] as const;
const FOLLOW_UP_TYPES = ["Chamada", "Visita", "WhatsApp", "E-mail", "Reunião"] as const;

const geoSchema = z.object({ lat: z.number(), lng: z.number() });
const profileSchema = z.object({
  nif: z.string(),
  card: z.string(),
  phone: z.string(),
  billing_email: z.string(),
  address: z.string(),
  municipality: z.string(),
  payment_terms: z.enum(PAYMENT_TERMS),
  credit_limit: z.number(),
  customer_since: z.string(),
  geo: geoSchema.optional(),
});
const followUpSchema = z.object({
  date: z.string(),
  type: z.enum(FOLLOW_UP_TYPES),
  note: z.string(),
  owner: z.string(),
});
const lastInteractionSchema = z.object({ date: z.string(), label: z.string() });

const createBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.enum(TAGS)).default([]),
  owner: z.string().optional(),
  zone: z.string().optional(),
  open_deals: z.number().int().default(0),
  pipeline_value_kz: z.number().int().default(0),
  win_probability: z.number().int().min(0).max(100).default(0),
  trend: z.array(z.number()).default([]),
  last_interaction: lastInteractionSchema.default({ date: "", label: "" }),
  activity_days: z.number().int().default(0),
  logo: z.string().optional(),
  archived: z.boolean().optional(),
  next_follow_up: followUpSchema.nullable().optional(),
  profile: profileSchema.nullable().optional(),
});

const updateBodySchema = z.object({
  name: z.string().min(1).optional(),
  owner: z.string().optional(),
  zone: z.string().optional(),
  tags: z.array(z.enum(TAGS)).optional(),
  pipeline_value_kz: z.number().int().optional(),
  open_deals: z.number().int().optional(),
  win_probability: z.number().int().min(0).max(100).optional(),
});

const bulkUpdateBodySchema = z.object({
  ids: z.array(z.string()).min(1),
  patch: z.object({ owner: z.string().optional(), zone: z.string().optional() }),
});

const followUpBodySchema = z.object({ follow_up: followUpSchema.nullable() });
const archiveBodySchema = z.object({ ids: z.array(z.string()).min(1) });
const restoreBodySchema = z.object({ companies: z.array(createBodySchema) });
const contactBodySchema = z.object({ date: z.string(), label: z.string() });
const importBodySchema = z.object({
  created: z.array(createBodySchema),
  updated: z.array(z.tuple([z.string(), profileSchema])),
});

function presentCompany(row: CompanyRow) {
  return {
    id: row.id,
    name: row.name,
    tags: row.tags,
    owner: row.owner,
    zone: row.zone,
    open_deals: row.openDeals,
    pipeline_value_kz: row.pipelineValueKz,
    win_probability: row.winProbability,
    trend: row.trend,
    last_interaction: row.lastInteraction,
    activity_days: row.activityDays,
    logo: row.logo,
    archived: row.archived,
    next_follow_up: row.nextFollowUp
      ? {
          date: row.nextFollowUp.date,
          type: row.nextFollowUp.type,
          note: row.nextFollowUp.note,
          owner: row.nextFollowUp.owner,
        }
      : null,
    profile: row.profile
      ? {
          nif: (row.profile as Record<string, unknown>).nif,
          card: (row.profile as Record<string, unknown>).card,
          phone: (row.profile as Record<string, unknown>).phone,
          billing_email: (row.profile as Record<string, unknown>).billingEmail,
          address: (row.profile as Record<string, unknown>).address,
          municipality: (row.profile as Record<string, unknown>).municipality,
          payment_terms: (row.profile as Record<string, unknown>).paymentTerms,
          credit_limit: (row.profile as Record<string, unknown>).creditLimit,
          customer_since: (row.profile as Record<string, unknown>).customerSince,
          geo: (row.profile as Record<string, unknown>).geo ?? undefined,
        }
      : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function profileToColumn(profile: z.infer<typeof profileSchema> | null | undefined) {
  if (!profile) return null;
  return {
    nif: profile.nif,
    card: profile.card,
    phone: profile.phone,
    billingEmail: profile.billing_email,
    address: profile.address,
    municipality: profile.municipality,
    paymentTerms: profile.payment_terms,
    creditLimit: profile.credit_limit,
    customerSince: profile.customer_since,
    geo: profile.geo,
  };
}

async function loadCompanyOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmCompanies).where(eq(schema.crmCompanies.id, id)).limit(1);
  if (!row) throw apiError("not_found", "O cliente não existe ou foi removido.");
  return row;
}

export async function crmCompaniesRoutes(app: FastifyInstance) {
  app.get("/crm/companies", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmCompanies);
    reply.send(listEnvelope(rows.map(presentCompany)));
  });

  app.get("/crm/companies/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadCompanyOrNotFound(id);
    reply.send(dataEnvelope(presentCompany(row)));
  });

  app.post("/crm/companies", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmCompanies.id }).from(schema.crmCompanies).where(eq(schema.crmCompanies.id, body.id)).limit(1);
    if (existing) {
      throw apiError("validation", "Já existe um cliente com este identificador.", {
        issues: [{ field: "id", message: "Já existe um cliente com este identificador." }],
      });
    }

    const [row] = await db
      .insert(schema.crmCompanies)
      .values({
        id: body.id,
        name: body.name,
        tags: body.tags,
        owner: body.owner,
        zone: body.zone,
        openDeals: body.open_deals,
        pipelineValueKz: body.pipeline_value_kz,
        winProbability: body.win_probability,
        trend: body.trend,
        lastInteraction: body.last_interaction,
        activityDays: body.activity_days,
        logo: body.logo,
        archived: body.archived ?? false,
        nextFollowUp: body.next_follow_up ?? null,
        profile: profileToColumn(body.profile),
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar o cliente.");

    reply.status(201).send(dataEnvelope(presentCompany(row)));
  });

  app.patch("/crm/companies/bulk", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = bulkUpdateBodySchema.parse(request.body);
    const patch: Partial<CompanyRow> = {};
    if (body.patch.owner !== undefined) patch.owner = body.patch.owner;
    if (body.patch.zone !== undefined) patch.zone = body.patch.zone;

    if (Object.keys(patch).length > 0) {
      await db.update(schema.crmCompanies).set({ ...patch, updatedAt: new Date() }).where(inArray(schema.crmCompanies.id, body.ids));
    }
    const rows = await db.select().from(schema.crmCompanies).where(inArray(schema.crmCompanies.id, body.ids));
    reply.send(listEnvelope(rows.map(presentCompany)));
  });

  app.patch("/crm/companies/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBodySchema.parse(request.body);
    await loadCompanyOrNotFound(id);

    const patch: Partial<CompanyRow> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.owner !== undefined) patch.owner = body.owner;
    if (body.zone !== undefined) patch.zone = body.zone;
    if (body.tags !== undefined) patch.tags = [...body.tags];
    if (body.pipeline_value_kz !== undefined) patch.pipelineValueKz = body.pipeline_value_kz;
    if (body.open_deals !== undefined) patch.openDeals = body.open_deals;
    if (body.win_probability !== undefined) patch.winProbability = body.win_probability;

    const [row] = await db.update(schema.crmCompanies).set({ ...patch, updatedAt: new Date() }).where(eq(schema.crmCompanies.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o cliente.");
    reply.send(dataEnvelope(presentCompany(row)));
  });

  app.put("/crm/companies/:id/follow-up", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = followUpBodySchema.parse(request.body);
    await loadCompanyOrNotFound(id);

    const [row] = await db
      .update(schema.crmCompanies)
      .set({ nextFollowUp: body.follow_up, updatedAt: new Date() })
      .where(eq(schema.crmCompanies.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o cliente.");
    reply.send(dataEnvelope(presentCompany(row)));
  });

  app.put("/crm/companies/:id/profile", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = profileSchema.parse(request.body);
    await loadCompanyOrNotFound(id);

    const [row] = await db
      .update(schema.crmCompanies)
      .set({ profile: profileToColumn(body), updatedAt: new Date() })
      .where(eq(schema.crmCompanies.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o cliente.");
    reply.send(dataEnvelope(presentCompany(row)));
  });

  app.post("/crm/companies/archive", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = archiveBodySchema.parse(request.body);
    await db.update(schema.crmCompanies).set({ archived: true, updatedAt: new Date() }).where(inArray(schema.crmCompanies.id, body.ids));
    const rows = await db.select().from(schema.crmCompanies).where(inArray(schema.crmCompanies.id, body.ids));
    reply.send(listEnvelope(rows.map(presentCompany)));
  });

  app.post("/crm/companies/restore", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = restoreBodySchema.parse(request.body);
    const ids = body.companies.map((item) => item.id);
    const existingRows = await db.select({ id: schema.crmCompanies.id }).from(schema.crmCompanies).where(inArray(schema.crmCompanies.id, ids));
    const existingIds = new Set(existingRows.map((item) => item.id));

    for (const company of body.companies) {
      if (!existingIds.has(company.id)) continue;
      await db
        .update(schema.crmCompanies)
        .set({
          name: company.name,
          tags: company.tags,
          owner: company.owner,
          zone: company.zone,
          openDeals: company.open_deals,
          pipelineValueKz: company.pipeline_value_kz,
          winProbability: company.win_probability,
          trend: company.trend,
          lastInteraction: company.last_interaction,
          activityDays: company.activity_days,
          logo: company.logo,
          archived: company.archived ?? false,
          nextFollowUp: company.next_follow_up ?? null,
          profile: profileToColumn(company.profile),
          updatedAt: new Date(),
        })
        .where(eq(schema.crmCompanies.id, company.id));
    }

    const rows = await db.select().from(schema.crmCompanies).where(inArray(schema.crmCompanies.id, [...existingIds]));
    reply.send(listEnvelope(rows.map(presentCompany)));
  });

  app.post("/crm/companies/:id/contact", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = contactBodySchema.parse(request.body);

    const [row] = await db.select().from(schema.crmCompanies).where(eq(schema.crmCompanies.id, id)).limit(1);
    if (row && body.date >= row.lastInteraction.date) {
      const today = new Date().toISOString().slice(0, 10);
      const days = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${body.date}T00:00:00Z`)) / 86_400_000));
      await db
        .update(schema.crmCompanies)
        .set({ lastInteraction: { date: body.date, label: body.label }, activityDays: days, updatedAt: new Date() })
        .where(eq(schema.crmCompanies.id, id));
    }

    reply.status(204).send();
  });

  app.post("/crm/companies/import", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = importBodySchema.parse(request.body);

    for (const company of body.created) {
      const [existing] = await db.select({ id: schema.crmCompanies.id }).from(schema.crmCompanies).where(eq(schema.crmCompanies.id, company.id)).limit(1);
      if (existing) continue;
      await db.insert(schema.crmCompanies).values({
        id: company.id,
        name: company.name,
        tags: company.tags,
        owner: company.owner,
        zone: company.zone,
        openDeals: company.open_deals,
        pipelineValueKz: company.pipeline_value_kz,
        winProbability: company.win_probability,
        trend: company.trend,
        lastInteraction: company.last_interaction,
        activityDays: company.activity_days,
        logo: company.logo,
        archived: company.archived ?? false,
        nextFollowUp: company.next_follow_up ?? null,
        profile: profileToColumn(company.profile),
      });
    }

    for (const [companyId, profile] of body.updated) {
      await db
        .update(schema.crmCompanies)
        .set({ profile: profileToColumn(profile), updatedAt: new Date() })
        .where(eq(schema.crmCompanies.id, companyId));
    }

    const rows = await db.select().from(schema.crmCompanies);
    reply.send(listEnvelope(rows.map(presentCompany)));
  });
}
