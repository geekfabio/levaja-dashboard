import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type CampaignRow = typeof schema.crmCampaigns.$inferSelect;

const CHANNELS = ["Email", "SMS"] as const;
type CampaignStatus = "Rascunho" | "Em revisão" | "Agendada" | "Enviada";

const DEFAULT_AUDIENCE = { zone: "all", segment: "all", abc: "all", inactiveDays: "all" };

const createFromTemplateBodySchema = z.object({
  channel: z.enum(CHANNELS),
  template_id: z.string().min(1, "Indique o modelo."),
});

const scheduleBodySchema = z.object({
  scheduled_at: z.string().min(1, "Indique a data de agendamento."),
  recipients: z.number().int().min(0),
  cost: z.number().optional(),
});

function presentCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    template_id: row.templateId ?? undefined,
    content: row.content,
    audience: row.audience,
    recipients: row.recipients,
    scheduled_at: row.scheduledAt ? row.scheduledAt.toISOString() : undefined,
    test_sent_at: row.testSentAt ? row.testSentAt.toISOString() : undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function loadCampaignOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmCampaigns).where(eq(schema.crmCampaigns.id, id)).limit(1);
  if (!row) throw apiError("not_found", "A campanha não existe ou foi removida.");
  return row;
}

function requireStatus(campaign: CampaignRow, status: CampaignStatus) {
  if (campaign.status !== status) {
    throw apiError("invalid_transition", `A campanha já não está «${campaign.status}».`);
  }
}

export async function crmCampaignsRoutes(app: FastifyInstance) {
  app.get("/crm/campaigns", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmCampaigns);
    reply.send(listEnvelope(rows.map(presentCampaign)));
  });

  app.post("/crm/campaigns", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createFromTemplateBodySchema.parse(request.body);
    const name = body.channel === "SMS" ? "Nova campanha SMS" : "Nova campanha";

    const [row] = await db
      .insert(schema.crmCampaigns)
      .values({
        id: newId("cmp"),
        name,
        channel: body.channel,
        status: "Rascunho",
        templateId: body.template_id,
        content: {},
        audience: { ...DEFAULT_AUDIENCE },
        recipients: 0,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar a campanha.");
    reply.status(201).send(dataEnvelope(presentCampaign(row)));
  });

  app.post("/crm/campaigns/:id/submit-for-review", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await loadCampaignOrNotFound(id);
    requireStatus(campaign, "Rascunho");

    const [row] = await db
      .update(schema.crmCampaigns)
      .set({ status: "Em revisão", updatedAt: new Date() })
      .where(eq(schema.crmCampaigns.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a campanha.");
    reply.send(dataEnvelope(presentCampaign(row)));
  });

  app.post("/crm/campaigns/:id/back-to-draft", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await loadCampaignOrNotFound(id);
    requireStatus(campaign, "Em revisão");

    const [row] = await db
      .update(schema.crmCampaigns)
      .set({ status: "Rascunho", testSentAt: null, updatedAt: new Date() })
      .where(eq(schema.crmCampaigns.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a campanha.");
    reply.send(dataEnvelope(presentCampaign(row)));
  });

  app.post("/crm/campaigns/:id/record-test", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await loadCampaignOrNotFound(id);
    requireStatus(campaign, "Em revisão");

    const [row] = await db
      .update(schema.crmCampaigns)
      .set({ testSentAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.crmCampaigns.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a campanha.");
    reply.send(dataEnvelope(presentCampaign(row)));
  });

  app.post("/crm/campaigns/:id/schedule", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = scheduleBodySchema.parse(request.body);
    const campaign = await loadCampaignOrNotFound(id);
    requireStatus(campaign, "Em revisão");
    if (!campaign.testSentAt) {
      throw apiError("invalid_transition", "Envie um teste antes de agendar.");
    }

    const [row] = await db
      .update(schema.crmCampaigns)
      .set({
        status: "Agendada",
        scheduledAt: new Date(body.scheduled_at),
        recipients: body.recipients,
        updatedAt: new Date(),
      })
      .where(eq(schema.crmCampaigns.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível agendar a campanha.");
    reply.send(dataEnvelope(presentCampaign(row)));
  });

  app.post("/crm/campaigns/:id/cancel-schedule", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await loadCampaignOrNotFound(id);
    requireStatus(campaign, "Agendada");

    const [row] = await db
      .update(schema.crmCampaigns)
      .set({ status: "Em revisão", scheduledAt: null, updatedAt: new Date() })
      .where(eq(schema.crmCampaigns.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a campanha.");
    reply.send(dataEnvelope(presentCampaign(row)));
  });
}
