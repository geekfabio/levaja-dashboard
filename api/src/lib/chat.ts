import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { chatMessages, chatThreads, serviceRequests } from "../db/schema/ops";
import { apiError } from "./envelope";
import type { AuthenticatedAccount } from "./authenticate";

const SUPPORT_THREAD_IDS = ["support-client", "support-provider"] as const;

type SupportThreadId = (typeof SUPPORT_THREAD_IDS)[number];

function isSupportThreadId(id: string): id is SupportThreadId {
  return (SUPPORT_THREAD_IDS as readonly string[]).includes(id);
}

type ResolvedThread = {
  internalId: string;
  publicId: string;
  kind: "service" | "support";
  requestId: string | null;
};

/**
 * Resolves the public thread id from the URL (a request id, or the literal
 * "support-client"/"support-provider") to the row this account owns, and
 * checks the caller may use it. A support thread is namespaced by account so
 * two different accounts asking for "support-client" each get their own
 * conversation — there is no one else who could see it.
 */
export async function resolveThread(publicId: string, account: AuthenticatedAccount): Promise<ResolvedThread> {
  if (isSupportThreadId(publicId)) {
    return { internalId: `${publicId}:${account.id}`, publicId, kind: "support", requestId: null };
  }

  const [serviceRequest] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, publicId)).limit(1);
  if (!serviceRequest) throw apiError("not_found", "Pedido não encontrado.");

  const isClient = serviceRequest.clientAccountId === account.id;
  const isAssignedProvider = !!serviceRequest.providerAccountId && serviceRequest.providerAccountId === account.id;
  if (!isClient && !isAssignedProvider) {
    throw apiError("forbidden", "Não tens acesso a esta conversa.");
  }

  return { internalId: publicId, publicId, kind: "service", requestId: publicId };
}

export async function ensureThread(thread: ResolvedThread) {
  const [existing] = await db.select().from(chatThreads).where(eq(chatThreads.id, thread.internalId)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(chatThreads)
    .values({ id: thread.internalId, kind: thread.kind, requestId: thread.requestId })
    .returning();
  return created!;
}

type ChatMessageRow = typeof chatMessages.$inferSelect;

export function presentChatMessage(row: ChatMessageRow, publicThreadId: string) {
  return {
    id: row.id,
    thread_id: publicThreadId,
    sender: row.sender,
    body: row.body,
    sent_at: row.sentAt.toISOString(),
    read: row.read,
  };
}
