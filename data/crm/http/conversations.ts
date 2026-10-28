import type { Conversation, ConversationChannel } from "@/data/conversations";
import type { ConversationsRepository } from "../repositories/conversations";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpConversations(http: HttpClient): ConversationsRepository {
  return {
    list: () => http.get<Conversation[]>("/crm/conversations"),
    markRead: (conversationId) => http.post<void>(`/crm/conversations/${id(conversationId)}/read`, {}),
    start: (contactId, channel: ConversationChannel) => http.post<Conversation>("/crm/conversations/start", { contactId, channel }),
    reply: (conversationId, body) => http.post<Conversation>(`/crm/conversations/${id(conversationId)}/reply`, { body }),
    receive: (contactId, channel: ConversationChannel, body) =>
      http.post<{ conversation: Conversation; optedOut: boolean }>("/crm/conversations/receive", { contactId, channel, body }),
  };
}
