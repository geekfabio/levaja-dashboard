import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";

type ActivityRow = typeof schema.crmActivities.$inferSelect;
type TaskRow = typeof schema.crmTasks.$inferSelect;

const ACTIVITY_TYPES = ["Visita", "Chamada", "E-mail", "Reunião", "Entrega", "Reclamação", "WhatsApp"] as const;
const TASK_STATUSES = ["Por Fazer", "Em Curso", "Feita"] as const;

const checkInSchema = z.object({ at: z.string(), lat: z.number(), lng: z.number(), accuracy: z.number(), distance: z.number().optional() });

const createActivityBodySchema = z.object({
  id: z.string().min(1),
  type: z.enum(ACTIVITY_TYPES),
  company_id: z.string().optional(),
  company_name: z.string().default(""),
  contact_name: z.string().optional(),
  owner: z.string().min(1),
  zone: z.string().min(1),
  date: z.string().min(1),
  note: z.string().default(""),
  check_in: checkInSchema.nullable().optional(),
});

const updateActivityBodySchema = z.object({
  type: z.enum(ACTIVITY_TYPES).optional(),
  company_id: z.string().optional(),
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  owner: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  note: z.string().optional(),
  check_in: checkInSchema.nullable().optional(),
});

const restoreActivityBodySchema = createActivityBodySchema;

const createTaskBodySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company_id: z.string().optional(),
  company_name: z.string().optional(),
  assignee: z.string().min(1),
  due_date: z.string().min(1),
  reminder_date: z.string().optional(),
  status: z.enum(TASK_STATUSES).default("Por Fazer"),
  notes: z.string().optional(),
});

const moveTaskStatusBodySchema = z.object({ status: z.enum(TASK_STATUSES) });
const postponeTaskBodySchema = z.object({ due_date: z.string().min(1) });

function presentActivity(row: ActivityRow) {
  return {
    id: row.id,
    type: row.type,
    company_id: row.companyId,
    company_name: row.companyName,
    contact_name: row.contactName ?? undefined,
    owner: row.owner,
    zone: row.zone,
    date: row.date.toISOString(),
    note: row.note ?? "",
    check_in: row.checkIn ?? undefined,
    created_at: row.createdAt.toISOString(),
  };
}

function presentTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    company_id: row.companyId ?? undefined,
    company_name: row.companyName ?? undefined,
    assignee: row.assignee,
    due_date: row.dueDate ? row.dueDate.toISOString() : undefined,
    reminder_date: row.reminderDate ? row.reminderDate.toISOString() : undefined,
    status: row.status,
    notes: row.notes ?? undefined,
  };
}

async function loadActivityOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmActivities).where(eq(schema.crmActivities.id, id)).limit(1);
  if (!row) throw apiError("not_found", "O registo não existe ou foi removido.");
  return row;
}

async function loadTaskOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmTasks).where(eq(schema.crmTasks.id, id)).limit(1);
  if (!row) throw apiError("not_found", "A tarefa não existe ou foi removida.");
  return row;
}

export async function crmActivitiesRoutes(app: FastifyInstance) {
  app.get("/crm/activities", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmActivities);
    reply.send(listEnvelope(rows.map(presentActivity)));
  });

  app.get("/crm/activities/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadActivityOrNotFound(id);
    reply.send(dataEnvelope(presentActivity(row)));
  });

  app.post("/crm/activities", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createActivityBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmActivities.id }).from(schema.crmActivities).where(eq(schema.crmActivities.id, body.id)).limit(1);
    if (existing) {
      throw apiError("validation", "Já existe um registo com este identificador.", {
        issues: [{ field: "id", message: "Já existe um registo com este identificador." }],
      });
    }

    const [row] = await db
      .insert(schema.crmActivities)
      .values({
        id: body.id,
        type: body.type,
        companyId: body.company_id,
        companyName: body.company_name,
        contactName: body.contact_name,
        owner: body.owner,
        zone: body.zone,
        date: new Date(body.date),
        note: body.note,
        checkIn: body.check_in ?? null,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar o registo.");
    reply.status(201).send(dataEnvelope(presentActivity(row)));
  });

  app.patch("/crm/activities/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateActivityBodySchema.parse(request.body);
    await loadActivityOrNotFound(id);

    const patch: Partial<ActivityRow> = {};
    if (body.type !== undefined) patch.type = body.type;
    if (body.company_id !== undefined) patch.companyId = body.company_id;
    if (body.company_name !== undefined) patch.companyName = body.company_name;
    if (body.contact_name !== undefined) patch.contactName = body.contact_name;
    if (body.owner !== undefined) patch.owner = body.owner;
    if (body.zone !== undefined) patch.zone = body.zone;
    if (body.date !== undefined) patch.date = new Date(body.date);
    if (body.note !== undefined) patch.note = body.note;
    if (body.check_in !== undefined) patch.checkIn = body.check_in;

    const [row] = await db.update(schema.crmActivities).set(patch).where(eq(schema.crmActivities.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o registo.");
    reply.send(dataEnvelope(presentActivity(row)));
  });

  app.delete("/crm/activities/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadActivityOrNotFound(id);
    await db.delete(schema.crmActivities).where(eq(schema.crmActivities.id, id));
    reply.send(dataEnvelope(presentActivity(row)));
  });

  app.put("/crm/activities/:id/restore", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = restoreActivityBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmActivities.id }).from(schema.crmActivities).where(eq(schema.crmActivities.id, id)).limit(1);
    const values = {
      type: body.type,
      companyId: body.company_id,
      companyName: body.company_name,
      contactName: body.contact_name,
      owner: body.owner,
      zone: body.zone,
      date: new Date(body.date),
      note: body.note,
      checkIn: body.check_in ?? null,
    };

    const [row] = existing
      ? await db.update(schema.crmActivities).set(values).where(eq(schema.crmActivities.id, id)).returning()
      : await db.insert(schema.crmActivities).values({ id: body.id, ...values }).returning();
    if (!row) throw apiError("server", "Não foi possível restaurar o registo.");
    reply.send(dataEnvelope(presentActivity(row)));
  });

  app.get("/crm/tasks", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmTasks);
    reply.send(listEnvelope(rows.map(presentTask)));
  });

  app.post("/crm/tasks", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createTaskBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmTasks.id }).from(schema.crmTasks).where(eq(schema.crmTasks.id, body.id)).limit(1);
    if (existing) {
      throw apiError("validation", "Já existe uma tarefa com este identificador.", {
        issues: [{ field: "id", message: "Já existe uma tarefa com este identificador." }],
      });
    }

    const [row] = await db
      .insert(schema.crmTasks)
      .values({
        id: body.id,
        title: body.title,
        companyId: body.company_id,
        companyName: body.company_name,
        assignee: body.assignee,
        dueDate: new Date(body.due_date),
        reminderDate: body.reminder_date ? new Date(body.reminder_date) : undefined,
        status: body.status,
        notes: body.notes,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar a tarefa.");
    reply.status(201).send(dataEnvelope(presentTask(row)));
  });

  app.patch("/crm/tasks/:id/status", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = moveTaskStatusBodySchema.parse(request.body);
    await loadTaskOrNotFound(id);

    const [row] = await db.update(schema.crmTasks).set({ status: body.status }).where(eq(schema.crmTasks.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a tarefa.");
    reply.send(dataEnvelope(presentTask(row)));
  });

  app.patch("/crm/tasks/:id/postpone", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = postponeTaskBodySchema.parse(request.body);
    await loadTaskOrNotFound(id);

    const [row] = await db.update(schema.crmTasks).set({ dueDate: new Date(body.due_date) }).where(eq(schema.crmTasks.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a tarefa.");
    reply.send(dataEnvelope(presentTask(row)));
  });
}
