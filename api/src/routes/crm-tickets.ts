import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type TicketRow = typeof schema.crmTickets.$inferSelect;

const STATUSES = ["Aberto", "Em Curso", "Em Espera", "Resolvido", "Fechado"] as const;
const PRIORITIES = ["Baixa", "Normal", "Alta", "Urgente"] as const;
const ORIGINS = ["E-mail", "Telefone", "WhatsApp", "Manual"] as const;
const CLOSED_STATUSES: (typeof STATUSES)[number][] = ["Resolvido", "Fechado"];

const createBodySchema = z.object({
  subject: z.string().min(1, "Indique o assunto do ticket."),
  description: z.string().default(""),
  company_id: z.string().optional(),
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  priority: z.enum(PRIORITIES),
  origin: z.enum(ORIGINS),
  assignee: z.string(),
  assignee_avatar: z.string(),
});

const addCommentBodySchema = z.object({ body: z.string() });
const setStatusBodySchema = z.object({ status: z.enum(STATUSES) });
const setPriorityBodySchema = z.object({ priority: z.enum(PRIORITIES) });
const setAssigneeBodySchema = z.object({ assignee: z.string(), assignee_avatar: z.string() });

function now() {
  return new Date();
}

function presentTicket(row: TicketRow) {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    company_id: row.companyId,
    company_name: row.companyName ?? undefined,
    contact_name: row.contactName ?? undefined,
    status: row.status,
    priority: row.priority,
    origin: row.origin,
    assignee: row.assignee,
    assignee_avatar: row.assigneeAvatar,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    first_response_at: row.firstResponseAt ? row.firstResponseAt.toISOString() : undefined,
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : undefined,
    comments: row.comments,
    timeline: row.timeline,
  };
}

async function loadTicketOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmTickets).where(eq(schema.crmTickets.id, id)).limit(1);
  if (!row) throw apiError("not_found", "O ticket não existe ou foi removido.");
  return row;
}

export async function crmTicketsRoutes(app: FastifyInstance) {
  app.get("/crm/tickets", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmTickets);
    reply.send(listEnvelope(rows.map(presentTicket)));
  });

  app.get("/crm/tickets/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadTicketOrNotFound(id);
    reply.send(dataEnvelope(presentTicket(row)));
  });

  app.post("/crm/tickets", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);
    const subject = body.subject.trim();
    if (!subject) {
      throw apiError("validation", "Indique o assunto do ticket.", { issues: [{ field: "subject", message: "Indique o assunto do ticket." }] });
    }

    const createdAt = now();
    const fromEmail = body.origin === "E-mail";
    const contactName = body.contact_name?.trim() || undefined;
    const timelineEntry = {
      id: newId("t"),
      label: fromEmail ? "Ticket criado a partir de e-mail" : "Ticket criado",
      date: createdAt.toISOString(),
      author: fromEmail ? contactName || "E-mail" : request.adminAccount!.fullName,
    };

    const [row] = await db
      .insert(schema.crmTickets)
      .values({
        id: newId("tk"),
        subject,
        description: body.description.trim(),
        companyId: body.company_id,
        companyName: body.company_name,
        contactName,
        status: "Aberto",
        priority: body.priority,
        origin: body.origin,
        assignee: body.assignee,
        assigneeAvatar: body.assignee_avatar,
        comments: [],
        timeline: [timelineEntry],
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar o ticket.");
    reply.status(201).send(dataEnvelope(presentTicket(row)));
  });

  app.post("/crm/tickets/:id/comments", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addCommentBodySchema.parse(request.body);
    const ticket = await loadTicketOrNotFound(id);

    const text = body.body.trim();
    if (!text) throw apiError("validation", "Escreva um comentário.");

    const at = now();
    const firstResponse = !ticket.firstResponseAt;
    const author = request.adminAccount!.fullName;
    const comments = [...ticket.comments, { id: newId("c"), author, authorAvatar: "", body: text, date: at.toISOString() }];
    const timeline = [
      ...ticket.timeline,
      { id: newId("t"), label: firstResponse ? "Primeira resposta enviada" : "Comentário adicionado", date: at.toISOString(), author },
    ];

    const [row] = await db
      .update(schema.crmTickets)
      .set({ comments, timeline, firstResponseAt: ticket.firstResponseAt ?? at, updatedAt: at })
      .where(eq(schema.crmTickets.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível adicionar o comentário.");
    reply.send(dataEnvelope(presentTicket(row)));
  });

  app.patch("/crm/tickets/:id/status", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = setStatusBodySchema.parse(request.body);
    const ticket = await loadTicketOrNotFound(id);

    if (ticket.status === body.status) {
      reply.send(dataEnvelope(presentTicket(ticket)));
      return;
    }

    const at = now();
    const closing = CLOSED_STATUSES.includes(body.status);
    const author = request.adminAccount!.fullName;
    const timeline = [...ticket.timeline, { id: newId("t"), label: `Estado alterado para ${body.status}`, date: at.toISOString(), author }];

    const [row] = await db
      .update(schema.crmTickets)
      .set({
        status: body.status,
        firstResponseAt: ticket.firstResponseAt ?? (body.status === "Aberto" ? null : at),
        resolvedAt: closing ? ticket.resolvedAt ?? at : null,
        timeline,
        updatedAt: at,
      })
      .where(eq(schema.crmTickets.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o ticket.");
    reply.send(dataEnvelope(presentTicket(row)));
  });

  app.patch("/crm/tickets/:id/priority", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = setPriorityBodySchema.parse(request.body);
    const ticket = await loadTicketOrNotFound(id);

    if (ticket.priority === body.priority) {
      reply.send(dataEnvelope(presentTicket(ticket)));
      return;
    }

    const at = now();
    const author = request.adminAccount!.fullName;
    const timeline = [...ticket.timeline, { id: newId("t"), label: `Prioridade alterada para ${body.priority}`, date: at.toISOString(), author }];

    const [row] = await db
      .update(schema.crmTickets)
      .set({ priority: body.priority, timeline, updatedAt: at })
      .where(eq(schema.crmTickets.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o ticket.");
    reply.send(dataEnvelope(presentTicket(row)));
  });

  app.patch("/crm/tickets/:id/assignee", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = setAssigneeBodySchema.parse(request.body);
    const ticket = await loadTicketOrNotFound(id);

    if (ticket.assignee === body.assignee) {
      reply.send(dataEnvelope(presentTicket(ticket)));
      return;
    }

    const at = now();
    const author = request.adminAccount!.fullName;
    const timeline = [...ticket.timeline, { id: newId("t"), label: `Atribuído a ${body.assignee}`, date: at.toISOString(), author }];

    const [row] = await db
      .update(schema.crmTickets)
      .set({ assignee: body.assignee, assigneeAvatar: body.assignee_avatar, timeline, updatedAt: at })
      .where(eq(schema.crmTickets.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o ticket.");
    reply.send(dataEnvelope(presentTicket(row)));
  });
}
