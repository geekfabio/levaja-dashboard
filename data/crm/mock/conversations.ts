import { CURRENT_USER } from "@/data/companies";
import type { Conversation, ConversationMessage } from "@/data/conversations";
import { useConversationsStore } from "@/stores/conversations-store";
import { useContactsStore } from "@/stores/contacts-store";
import type { Contact } from "@/data/contacts";
import { useMessagingStore } from "@/stores/messaging-store";
import { isOptOut } from "@/lib/conversations";
import { nowLuandaLocal } from "@/lib/format";
import { RepositoryError } from "../repositories/errors";
import type { ConversationsRepository } from "../repositories/conversations";

const CONSENT_KEY = { WhatsApp: "whatsapp", SMS: "sms" } as const;

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function conversations() {
  return useConversationsStore.getState().conversations;
}

function setConversations(next: Conversation[]) {
  useConversationsStore.setState({ conversations: next });
}

function message(direction: ConversationMessage["direction"], body: string, extra: Partial<ConversationMessage> = {}): ConversationMessage {
  return { id: `m-${crypto.randomUUID().slice(0, 8)}`, direction, body, at: nowLuandaLocal(), ...extra };
}

export function createMockConversations(latencyMs: number): ConversationsRepository {
  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(conversations());
    },

    markRead: async (id) => {
      await sleep(latencyMs);
      setConversations(conversations().map((item) => (item.id === id ? { ...item, unread: 0 } : item)));
    },

    start: async (contactId, channel) => {
      await sleep(latencyMs);
      const existing = conversations().find((item) => item.contactId === contactId && item.channel === channel);
      if (existing) return structuredClone(existing);
      const conversation: Conversation = { id: `cv-${crypto.randomUUID().slice(0, 8)}`, contactId, channel, messages: [], unread: 0 };
      setConversations([conversation, ...conversations()]);
      return structuredClone(conversation);
    },

    reply: async (id, body) => {
      await sleep(latencyMs);
      const conversation = conversations().find((item) => item.id === id);
      const contact = useContactsStore.getState().contacts.find((item) => item.id === conversation?.contactId);
      if (!conversation || !contact) throw new RepositoryError("not_found", "A conversa não existe.");
      const text = body.trim();
      if (!text) throw new RepositoryError("validation", "Escreva uma mensagem.");
      const consent = contact.consent[CONSENT_KEY[conversation.channel]];
      let outgoing: ConversationMessage;
      if (contact.contactability !== "Válido" || !consent.granted) {
        outgoing = message("out", text, { author: CURRENT_USER.name, status: "Bloqueado" });
      } else {
        const record = useMessagingStore.getState().send({
          channel: conversation.channel,
          to: conversation.channel === "WhatsApp" ? contact.whatsapp : contact.phone,
          toName: contact.name,
          body: text,
          companyId: contact.companyId,
          contactId: contact.id,
          source: `Conversa com ${contact.name}`,
        });
        outgoing = message("out", text, { author: CURRENT_USER.name, status: record.status });
      }
      const next = conversations().map((item) => (item.id === id ? { ...item, messages: [...item.messages, outgoing] } : item));
      setConversations(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    receive: async (contactId, channel, body) => {
      await sleep(latencyMs);
      const contact = useContactsStore.getState().contacts.find((item) => item.id === contactId);
      if (!contact) throw new RepositoryError("not_found", "O contacto não existe.");
      let conversation = conversations().find((item) => item.contactId === contactId && item.channel === channel);
      if (!conversation) {
        conversation = { id: `cv-${crypto.randomUUID().slice(0, 8)}`, contactId, channel, messages: [], unread: 0 };
        setConversations([conversation, ...conversations()]);
      }
      const incoming = message("in", body);
      const extra: ConversationMessage[] = [];
      const key = CONSENT_KEY[channel];
      const optedOut = isOptOut(body) && contact.consent[key].granted;
      if (optedOut) {
        extra.push(message("system", `${contact.name} pediu para não receber mais ${channel}. Consentimento retirado automaticamente.`));
        const revoked = { granted: false, date: nowLuandaLocal().slice(0, 10), origin: "Atualizado manualmente" };
        useContactsStore.setState((state) => ({
          contacts: state.contacts.map((item): Contact => (item.id === contactId ? { ...item, consent: { ...item.consent, [key]: revoked } } : item)),
        }));
      }
      const id = conversation.id;
      const activeId = useConversationsStore.getState().activeId;
      setConversations([
        ...conversations()
          .filter((item) => item.id === id)
          .map((item) => ({ ...item, messages: [...item.messages, incoming, ...extra], unread: activeId === id ? 0 : item.unread + 1 })),
        ...conversations().filter((item) => item.id !== id),
      ]);
      return { conversation: structuredClone(conversations().find((item) => item.id === id)!), optedOut };
    },
  };
}
