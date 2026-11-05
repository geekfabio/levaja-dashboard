import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type AutomationRow = typeof schema.crmAutomations.$inferSelect;

const STATUSES = ["Ativa", "Pausada", "Rascunho"] as const;

const MAX_DISCOUNT_PERCENT = 30;

const DEFAULT_TRIGGER = {
  type: "cliente-criado",
  days: 30,
  stage: "Proposta",
  clientStage: "Reactivação",
  engagement: "Clicou",
};

const DEFAULT_CONDITIONS = { zone: "all", segment: "all", abc: "all" };

const setStatusBodySchema = z.object({ status: z.enum(STATUSES) });

type AutomationStep = {
  id?: string;
  action?: string;
  taskTitle?: string;
  message?: string;
  segmentName?: string;
  discountPercent?: number;
  discountValidDays?: number;
};

function automationIssues(name: string, steps: unknown): string[] {
  const issues: string[] = [];
  if (!name.trim()) issues.push("Dê um nome à automação.");
  const list = Array.isArray(steps) ? (steps as AutomationStep[]) : [];
  if (list.length === 0) issues.push("Adicione pelo menos um passo.");

  list.forEach((step, index) => {
    const label = `Passo ${index + 1}`;
    if (step.action === "criar-tarefa" && !step.taskTitle?.trim()) {
      issues.push(`${label}: indique o título da tarefa.`);
    }
    if (step.action === "notificar-gestor" && !step.message?.trim()) {
      issues.push(`${label}: escreva a mensagem para o gestor.`);
    }
    if (step.action === "adicionar-segmento" && !step.segmentName?.trim()) {
      issues.push(`${label}: indique o nome do segmento.`);
    }
    if (
      step.action === "propor-desconto" &&
      (!step.discountPercent || step.discountPercent < 1 || step.discountPercent > MAX_DISCOUNT_PERCENT)
    ) {
      issues.push(`${label}: o desconto tem de estar entre 1% e ${MAX_DISCOUNT_PERCENT}%.`);
    }
    if (step.action === "propor-desconto" && (!step.discountValidDays || step.discountValidDays < 1)) {
      issues.push(`${label}: a validade tem de ser de pelo menos 1 dia.`);
    }
  });

  return issues;
}

function presentAutomation(row: AutomationRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    trigger: row.trigger,
    conditions: row.conditions,
    steps: row.steps,
    enrolled: row.enrolled,
    completed: row.completed,
    activated_at: row.activatedAt ? row.activatedAt.toISOString() : undefined,
    updated_at: row.updatedAt.toISOString(),
  };
}

async function loadAutomationOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmAutomations).where(eq(schema.crmAutomations.id, id)).limit(1);
  if (!row) throw apiError("not_found", "A automação não existe ou foi removida.");
  return row;
}

export async function crmAutomationsRoutes(app: FastifyInstance) {
  app.get("/crm/automations", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmAutomations);
    reply.send(listEnvelope(rows.map(presentAutomation)));
  });

  app.post("/crm/automations", { preHandler: [authenticateAdmin, requireCsrf] }, async (_request, reply) => {
    const [row] = await db
      .insert(schema.crmAutomations)
      .values({
        id: newId("aut"),
        name: "Nova automação",
        status: "Rascunho",
        trigger: { ...DEFAULT_TRIGGER },
        conditions: { ...DEFAULT_CONDITIONS },
        steps: [],
        enrolled: 0,
        completed: 0,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar a automação.");
    reply.status(201).send(dataEnvelope(presentAutomation(row)));
  });

  app.delete("/crm/automations/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const automation = await loadAutomationOrNotFound(id);
    if (automation.status !== "Rascunho") {
      throw apiError("invalid_transition", "Só é possível remover automações em rascunho.");
    }

    await db.delete(schema.crmAutomations).where(eq(schema.crmAutomations.id, id));
    reply.send(dataEnvelope(presentAutomation(automation)));
  });

  app.patch("/crm/automations/:id/status", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = setStatusBodySchema.parse(request.body);
    const automation = await loadAutomationOrNotFound(id);

    if (body.status === "Ativa") {
      const issues = automationIssues(automation.name, automation.steps);
      if (issues.length > 0) {
        throw apiError("validation", "Complete a automação antes de a ativar.", { issues });
      }
    }

    if (automation.status === body.status) {
      reply.send(dataEnvelope(presentAutomation(automation)));
      return;
    }

    const now = new Date();
    const [row] = await db
      .update(schema.crmAutomations)
      .set({
        status: body.status,
        activatedAt: body.status === "Ativa" ? now : automation.activatedAt,
        updatedAt: now,
      })
      .where(eq(schema.crmAutomations.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a automação.");
    reply.send(dataEnvelope(presentAutomation(row)));
  });
}
