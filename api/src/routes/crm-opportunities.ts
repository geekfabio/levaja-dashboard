import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type OpportunityRow = typeof schema.crmOpportunities.$inferSelect;

const STAGES = ["Qualificação", "Proposta", "Negociação", "Fechada - Ganha", "Fechada - Perdida"] as const;
const LOSS_REASONS = ["Preço", "Concorrência", "Sem orçamento", "Projeto cancelado", "Sem resposta"] as const;

const createBodySchema = z.object({
  company_id: z.string().min(1),
  company_name: z.string().default(""),
  contact_name: z.string().min(1, "Indique o contacto."),
  value_kz: z.number(),
  stage: z.enum(STAGES),
  probability: z.number().int().min(0).max(100),
  expected_close_date: z.string().optional(),
  owner: z.string().optional(),
  products: z.array(z.string()).default([]),
});

const updateBodySchema = z.object({
  contact_name: z.string().min(1).optional(),
  value_kz: z.number().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().optional(),
  owner: z.string().optional(),
});

const moveStageBodySchema = z.object({ stage: z.enum(STAGES), loss_reason: z.enum(LOSS_REASONS).optional() });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function presentOpportunity(row: OpportunityRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    company_name: row.companyName,
    contact_name: row.contactName,
    value_kz: row.valueKz,
    stage: row.stage,
    probability: row.probability,
    expected_close_date: row.expectedCloseDate ? row.expectedCloseDate.toISOString().slice(0, 10) : null,
    owner: row.owner,
    products: row.products,
    stage_history: row.stageHistory,
    loss_reason: row.lossReason,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function loadOpportunityOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmOpportunities).where(eq(schema.crmOpportunities.id, id)).limit(1);
  if (!row) throw apiError("not_found", "A oportunidade não existe ou foi removida.");
  return row;
}

export async function crmOpportunitiesRoutes(app: FastifyInstance) {
  app.get("/crm/opportunities", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmOpportunities);
    reply.send(listEnvelope(rows.map(presentOpportunity)));
  });

  app.get("/crm/opportunities/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadOpportunityOrNotFound(id);
    reply.send(dataEnvelope(presentOpportunity(row)));
  });

  app.post("/crm/opportunities", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);
    const contactName = body.contact_name.trim();
    if (!contactName) {
      throw apiError("validation", "Indique o contacto.", { issues: [{ field: "contact_name", message: "Indique o contacto." }] });
    }

    const expectedCloseDate = body.expected_close_date || today();
    const [row] = await db
      .insert(schema.crmOpportunities)
      .values({
        id: newId("op"),
        companyId: body.company_id,
        companyName: body.company_name,
        contactName,
        valueKz: Math.max(0, Math.round(body.value_kz || 0)),
        stage: body.stage,
        probability: body.probability,
        expectedCloseDate: new Date(`${expectedCloseDate}T00:00:00Z`),
        owner: body.owner,
        products: [...body.products],
        stageHistory: [{ stage: body.stage, date: today(), author: body.owner ?? "" }],
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar a oportunidade.");
    reply.status(201).send(dataEnvelope(presentOpportunity(row)));
  });

  app.patch("/crm/opportunities/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBodySchema.parse(request.body);
    await loadOpportunityOrNotFound(id);

    const patch: Partial<OpportunityRow> = {};
    if (body.contact_name !== undefined) patch.contactName = body.contact_name;
    if (body.value_kz !== undefined) patch.valueKz = body.value_kz;
    if (body.probability !== undefined) patch.probability = body.probability;
    if (body.expected_close_date !== undefined) patch.expectedCloseDate = new Date(`${body.expected_close_date}T00:00:00Z`);
    if (body.owner !== undefined) patch.owner = body.owner;

    const [row] = await db.update(schema.crmOpportunities).set({ ...patch, updatedAt: new Date() }).where(eq(schema.crmOpportunities.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a oportunidade.");
    reply.send(dataEnvelope(presentOpportunity(row)));
  });

  app.post("/crm/opportunities/:id/stage", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moveStageBodySchema.parse(request.body);
    const opportunity = await loadOpportunityOrNotFound(id);

    if (body.stage === "Fechada - Perdida" && !body.loss_reason) {
      throw apiError("validation", "Indique o motivo da perda.", { issues: [{ field: "loss_reason", message: "Indique o motivo da perda." }] });
    }
    if (opportunity.stage === body.stage) {
      reply.send(dataEnvelope(presentOpportunity(opportunity)));
      return;
    }

    const probability = body.stage === "Fechada - Ganha" ? 100 : body.stage === "Fechada - Perdida" ? 0 : opportunity.probability;
    const lossReason = body.stage === "Fechada - Perdida" ? body.loss_reason ?? null : null;
    const author = request.adminAccount!.fullName;
    const stageHistory = [...opportunity.stageHistory, { stage: body.stage, date: today(), author }];

    const [row] = await db
      .update(schema.crmOpportunities)
      .set({ stage: body.stage, probability, lossReason, stageHistory, updatedAt: new Date() })
      .where(eq(schema.crmOpportunities.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a oportunidade.");
    reply.send(dataEnvelope(presentOpportunity(row)));
  });
}
