import type { Conversation, ConversationChannel, ConversationMessage } from "@/data/conversations";

export interface ConversationsRepository {
  list(): Promise<Conversation[]>;
  markRead(id: string): Promise<void>;
  start(contactId: string, channel: ConversationChannel): Promise<Conversation>;
  reply(id: string, body: string): Promise<Conversation>;
  receive(contactId: string, channel: ConversationChannel, body: string): Promise<{ conversation: Conversation; optedOut: boolean }>;
}

export type { Conversation, ConversationChannel, ConversationMessage };
