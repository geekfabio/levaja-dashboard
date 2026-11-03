import { and, asc, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { chatMessages } from "../db/schema/ops";
import { authenticate } from "../lib/authenticate";
import { ensureThread, presentChatMessage, resolveThread } from "../lib/chat";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

const participantSchema = z.enum(["client", "provider"]);
const sendMessageBodySchema = z.object({ sender: participantSchema, body: z.string().min(1) });
const markReadBodySchema = z.object({ reader: participantSchema });

export async function chatRoutes(app: FastifyInstance) {
  app.get("/threads/:id/messages", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const thread = await resolveThread(id, request.account!);

    const rows = await db.select().from(chatMessages).where(eq(chatMessages.threadId, thread.internalId)).orderBy(asc(chatMessages.sentAt));
    reply.send(listEnvelope(rows.map((row) => presentChatMessage(row, thread.publicId))));
  });

  app.get("/threads/:id/changes", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const thread = await resolveThread(id, request.account!);
    const query = z.object({ since: z.string().min(1).optional() }).parse(request.query);
    const now = new Date();

    if (!query.since) {
      reply.send({ data: [], meta: { cursor: now.toISOString() } });
      return;
    }

    const since = new Date(query.since);
    if (Number.isNaN(since.getTime())) {
      throw apiError("validation", "Parâmetro since inválido.");
    }

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.threadId, thread.internalId), gt(chatMessages.sentAt, since)))
      .orderBy(asc(chatMessages.sentAt));
    reply.send({ data: rows.map((row) => presentChatMessage(row, thread.publicId)), meta: { cursor: now.toISOString() } });
  });

  app.post("/threads/:id/messages", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = request.account!;
    const body = sendMessageBodySchema.parse(request.body);
    const thread = await resolveThread(id, account);

    if (body.sender !== account.kind) {
      throw apiError("forbidden", "sender tem de corresponder à conta autenticada.");
    }

    await ensureThread(thread);

    const now = new Date();
    const [row] = await db
      .insert(chatMessages)
      .values({ id: newId("msg"), threadId: thread.internalId, sender: body.sender, body: body.body, sentAt: now, read: false })
      .returning();

    reply.status(201).send(dataEnvelope(presentChatMessage(row!, thread.publicId)));
  });

  app.post("/threads/:id/read", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = request.account!;
    const body = markReadBodySchema.parse(request.body);
    const thread = await resolveThread(id, account);

    if (body.reader !== account.kind) {
      throw apiError("forbidden", "reader tem de corresponder à conta autenticada.");
    }

    await db
      .update(chatMessages)
      .set({ read: true })
      .where(and(eq(chatMessages.threadId, thread.internalId), eq(chatMessages.sender, body.reader === "client" ? "provider" : "client")));

    reply.status(204).send();
  });
}
