import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { emergencyContacts, helpArticles, serviceRequests, sosAlerts, supportTickets } from "../db/schema/ops";
import { authenticate } from "../lib/authenticate";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

const HELP_CATEGORIES = ["orders", "payments", "safety", "account"] as const;

const helpQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.enum(HELP_CATEGORIES).optional(),
});

const ticketBodySchema = z.object({
  request_id: z.string().min(1, "Indica o pedido a que a ocorrência se refere."),
  reason: z.string().trim().min(1, "Indica o motivo da ocorrência."),
  description: z.string().trim().min(10, "Descreve o problema com pelo menos 10 caracteres."),
});

const sosBodySchema = z.object({
  request_id: z.string().min(1).nullable(),
  lat: z.number(),
  lng: z.number(),
});

function matchesText(q: string | undefined, ...fields: string[]) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((field) => field.toLowerCase().includes(needle));
}

function presentHelpArticle(row: typeof helpArticles.$inferSelect) {
  return { id: row.id, category: row.category, question: row.question, answer: row.answer };
}

function presentEmergencyContact(row: typeof emergencyContacts.$inferSelect) {
  return { id: row.id, label: row.label, phone_number: row.phoneNumber };
}

async function generateTicketCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `TK-${10000 + Math.floor(Math.random() * 90000)}`;
    const [existing] = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.code, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw apiError("server", "Não foi possível gerar o código da ocorrência.");
}

export async function supportMobileRoutes(app: FastifyInstance) {
  app.get("/help", async (request, reply) => {
    const query = helpQuerySchema.parse(request.query);

    const rows = await db.select().from(helpArticles);
    const filtered = rows
      .filter((row) => !query.category || row.category === query.category)
      .filter((row) => matchesText(query.q, row.question, row.answer));

    reply.send(dataEnvelope(filtered.map(presentHelpArticle)));
  });

  app.get("/help/emergency-contacts", async (_request, reply) => {
    const rows = await db.select().from(emergencyContacts);
    reply.send(dataEnvelope(rows.map(presentEmergencyContact)));
  });

  app.post("/tickets", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    const body = ticketBodySchema.parse(request.body);

    const [serviceRequest] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, body.request_id)).limit(1);
    if (!serviceRequest) throw apiError("not_found", "Pedido não encontrado.");
    if (serviceRequest.clientAccountId !== account.id && serviceRequest.providerAccountId !== account.id) {
      throw apiError("forbidden", "Só podes abrir uma ocorrência sobre um pedido teu.");
    }

    const code = await generateTicketCode();
    await db.insert(supportTickets).values({
      id: newId("tkt"),
      code,
      requestId: body.request_id,
      accountId: account.id,
      reason: body.reason,
      description: body.description,
      status: "open",
      priority: "medium",
    });

    reply.status(201).send(dataEnvelope({ code }));
  });

  app.post("/sos", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    const body = sosBodySchema.parse(request.body);

    if (body.request_id) {
      const [serviceRequest] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, body.request_id)).limit(1);
      if (!serviceRequest) throw apiError("not_found", "Pedido não encontrado.");
      if (serviceRequest.clientAccountId !== account.id && serviceRequest.providerAccountId !== account.id) {
        throw apiError("forbidden", "Só podes enviar um alerta SOS sobre um pedido teu.");
      }
    }

    await db.insert(sosAlerts).values({
      id: newId("sos"),
      requestId: body.request_id,
      accountId: account.id,
      lat: body.lat.toString(),
      lng: body.lng.toString(),
    });

    reply.status(204).send();
  });
}
