import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type ConversationRow = typeof schema.crmConversations.$inferSelect;
type MessageRow = typeof schema.crmConversationMessages.$inferSelect;
type ConsentState = { granted: boolean; date: string; origin: string };
type Consent = { email: ConsentState; sms: ConsentState; whatsapp: ConsentState };

const CHANNELS = ["WhatsApp", "SMS"] as const;
const CONSENT_KEY = { WhatsApp: "whatsapp", SMS: "sms" } as const;
const OPT_OUT_KEYWORDS = ["PARAR", "STOP", "SAIR"];

const startBodySchema = z.object({ contact_id: z.string().min(1), channel: z.enum(CHANNELS) });
const replyBodySchema = z.object({ body: z.string() });
const receiveBodySchema = z.object({ contact_id: z.string().min(1), channel: z.enum(CHANNELS), body: z.string() });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isOptOut(body: string) {
  const normalized = body
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return OPT_OUT_KEYWORDS.includes(normalized);
}

async function messagesFor(conversationId: string) {
  return db
    .select()
    .from(schema.crmConversationMessages)
    .where(eq(schema.crmConversationMessages.conversationId, conversationId))
    .orderBy(asc(schema.crmConversationMessages.at));
}

function presentMessage(row: MessageRow) {
  return {
    id: row.id,
    direction: row.direction,
    body: row.body,
    at: row.at.toISOString(),
    author: row.author ?? undefined,
    status: row.status ?? undefined,
  };
}

async function presentConversation(row: ConversationRow) {
  const messages = await messagesFor(row.id);
  return {
    id: row.id,
    contact_id: row.contactId,
    channel: row.channel,
    unread: row.unread,
    messages: messages.map(presentMessage),
  };
}

async function loadConversationOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmConversations).where(eq(schema.crmConversations.id, id)).limit(1);
  if (!row) throw apiError("not_found", "A conversa não existe.");
  return row;
}

async function loadContactOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmContacts).where(eq(schema.crmContacts.id, id)).limit(1);
  if (!row) throw apiError("not_found", "O contacto não existe.");
  return row;
}

async function insertMessage(conversationId: string, values: Omit<typeof schema.crmConversationMessages.$inferInsert, "id" | "conversationId">) {
  const [row] = await db
    .insert(schema.crmConversationMessages)
    .values({ id: newId("m"), conversationId, ...values })
    .returning();
  if (!row) throw apiError("server", "Não foi possível registar a mensagem.");
  return row;
}

export async function crmConversationsRoutes(app: FastifyInstance) {
  app.get("/crm/conversations", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmConversations);
    const data = await Promise.all(rows.map(presentConversation));
    reply.send(listEnvelope(data));
  });

  app.get("/crm/conversations/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadConversationOrNotFound(id);
    reply.send(dataEnvelope(await presentConversation(row)));
  });

  app.patch("/crm/conversations/:id/read", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await loadConversationOrNotFound(id);
    await db.update(schema.crmConversations).set({ unread: 0 }).where(eq(schema.crmConversations.id, id));
    reply.status(204).send();
  });

  app.post("/crm/conversations", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = startBodySchema.parse(request.body);
    await loadContactOrNotFound(body.contact_id);

    const [existing] = await db
      .select()
      .from(schema.crmConversations)
      .where(eq(schema.crmConversations.contactId, body.contact_id));
    const found = existing && existing.channel === body.channel ? existing : undefined;
    if (found) {
      reply.send(dataEnvelope(await presentConversation(found)));
      return;
    }

    const [row] = await db
      .insert(schema.crmConversations)
      .values({ id: newId("cv"), contactId: body.contact_id, channel: body.channel, unread: 0 })
      .returning();
    if (!row) throw apiError("server", "Não foi possível iniciar a conversa.");
    reply.status(201).send(dataEnvelope(await presentConversation(row)));
  });

  app.post("/crm/conversations/:id/reply", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = replyBodySchema.parse(request.body);
    const conversation = await loadConversationOrNotFound(id);
    const contact = await loadContactOrNotFound(conversation.contactId);

    const text = body.body.trim();
    if (!text) throw apiError("validation", "Escreva uma mensagem.", { issues: [{ field: "body", message: "Escreva uma mensagem." }] });

    const author = request.adminAccount!.fullName;
    const key = CONSENT_KEY[conversation.channel as keyof typeof CONSENT_KEY];
    const consent = contact.consent as Consent;
    const blocked = contact.contactability !== "Válido" || !consent[key]?.granted;

    await insertMessage(conversation.id, { direction: "out", body: text, author, status: blocked ? "Bloqueado" : "Simulado" });

    reply.send(dataEnvelope(await presentConversation(conversation)));
  });

  app.post("/crm/conversations/receive", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = receiveBodySchema.parse(request.body);
    const contact = await loadContactOrNotFound(body.contact_id);

    const [existing] = await db
      .select()
      .from(schema.crmConversations)
      .where(eq(schema.crmConversations.contactId, body.contact_id));
    let conversation = existing && existing.channel === body.channel ? existing : undefined;
    if (!conversation) {
      const [created] = await db
        .insert(schema.crmConversations)
        .values({ id: newId("cv"), contactId: body.contact_id, channel: body.channel, unread: 0 })
        .returning();
      if (!created) throw apiError("server", "Não foi possível iniciar a conversa.");
      conversation = created;
    }

    await insertMessage(conversation.id, { direction: "in", body: body.body });

    const key = CONSENT_KEY[body.channel];
    const consent = contact.consent as Consent;
    const optedOut = isOptOut(body.body) && Boolean(consent[key]?.granted);

    if (optedOut) {
      await insertMessage(conversation.id, {
        direction: "system",
        body: `${contact.name} pediu para não receber mais ${body.channel}. Consentimento retirado automaticamente.`,
      });
      const revoked: ConsentState = { granted: false, date: today(), origin: "Atualizado manualmente" };
      await db
        .update(schema.crmContacts)
        .set({ consent: { ...consent, [key]: revoked } })
        .where(eq(schema.crmContacts.id, contact.id));
    }

    await db
      .update(schema.crmConversations)
      .set({ unread: conversation.unread + 1 })
      .where(eq(schema.crmConversations.id, conversation.id));

    const [row] = await db.select().from(schema.crmConversations).where(eq(schema.crmConversations.id, conversation.id)).limit(1);
    if (!row) throw apiError("server", "Não foi possível registar a mensagem.");
    reply.send(dataEnvelope({ conversation: await presentConversation(row), opted_out: optedOut }));
  });
}
