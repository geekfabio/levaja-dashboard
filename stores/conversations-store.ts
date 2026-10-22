import { create } from "zustand";
import { CURRENT_USER } from "@/data/companies";
import {
  CONVERSATIONS,
  INCOMING_SAMPLES,
  type Conversation,
  type ConversationChannel,
  type ConversationMessage,
} from "@/data/conversations";
import { isOptOut } from "@/lib/conversations";
import { nowLuandaLocal } from "@/lib/format";
import { recordEvent } from "./audit-store";
import { useContactsStore } from "./contacts-store";
import { useMessagingStore } from "./messaging-store";
import { useNotificationsStore } from "./notifications-store";

const CONSENT_KEY = { WhatsApp: "whatsapp", SMS: "sms" } as const;

type ConversationsState = {
  conversations: Conversation[];
  activeId: string | null;
  open: (id: string | null) => void;
  start: (contactId: string, channel: ConversationChannel) => string;
  reply: (id: string, body: string) => ConversationMessage | undefined;
  receive: (contactId: string, channel: ConversationChannel, body: string) => void;
  simulateIncoming: () => void;
};

function message(direction: ConversationMessage["direction"], body: string, extra: Partial<ConversationMessage> = {}): ConversationMessage {
  return { id: `m-${crypto.randomUUID().slice(0, 8)}`, direction, body, at: nowLuandaLocal(), ...extra };
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: CONVERSATIONS,
  activeId: null,

  open: (id) =>
    set((state) => ({
      activeId: id,
      conversations: state.conversations.map((item) => (item.id === id ? { ...item, unread: 0 } : item)),
    })),

  start: (contactId, channel) => {
    const existing = get().conversations.find((item) => item.contactId === contactId && item.channel === channel);
    if (existing) {
      get().open(existing.id);
      return existing.id;
    }
    const id = `cv-${crypto.randomUUID().slice(0, 8)}`;
    set((state) => ({ conversations: [{ id, contactId, channel, messages: [], unread: 0 }, ...state.conversations], activeId: id }));
    return id;
  },

  reply: (id, body) => {
    const conversation = get().conversations.find((item) => item.id === id);
    const contact = useContactsStore.getState().contacts.find((item) => item.id === conversation?.contactId);
    if (!conversation || !contact || !body.trim()) return undefined;
    const consent = contact.consent[CONSENT_KEY[conversation.channel]];
    let outgoing: ConversationMessage;
    if (contact.contactability !== "Válido" || !consent.granted) {
      outgoing = message("out", body.trim(), {
        author: CURRENT_USER.name,
        status: "Bloqueado",
      });
    } else {
      const record = useMessagingStore.getState().send({
        channel: conversation.channel,
        to: conversation.channel === "WhatsApp" ? contact.whatsapp : contact.phone,
        toName: contact.name,
        body: body.trim(),
        companyId: contact.companyId,
        contactId: contact.id,
        source: `Conversa com ${contact.name}`,
      });
      outgoing = message("out", body.trim(), { author: CURRENT_USER.name, status: record.status });
    }
    set((state) => ({
      conversations: state.conversations.map((item) =>
        item.id === id ? { ...item, messages: [...item.messages, outgoing] } : item,
      ),
    }));
    return outgoing;
  },

  receive: (contactId, channel, body) => {
    const contacts = useContactsStore.getState();
    const contact = contacts.contacts.find((item) => item.id === contactId);
    if (!contact) return;
    let conversation = get().conversations.find((item) => item.contactId === contactId && item.channel === channel);
    if (!conversation) {
      conversation = { id: `cv-${crypto.randomUUID().slice(0, 8)}`, contactId, channel, messages: [], unread: 0 };
      set((state) => ({ conversations: [conversation!, ...state.conversations] }));
    }
    const incoming = message("in", body);
    const extra: ConversationMessage[] = [];
    const key = CONSENT_KEY[channel];
    if (isOptOut(body) && contact.consent[key].granted) {
      contacts.toggleConsent(contactId, key);
      extra.push(message("system", `${contact.name} pediu para não receber mais ${channel}. Consentimento retirado automaticamente.`));
      recordEvent({
        action: `retirou o consentimento de ${channel} a pedido (resposta «${body.trim()}») de`,
        target: { module: "Contactos", id: contactId, label: contact.name },
        companyId: contact.companyId,
        sensitive: true,
        notify: "alert",
      });
    }
    const id = conversation.id;
    set((state) => ({
      conversations: [
        ...state.conversations
          .filter((item) => item.id === id)
          .map((item) => ({
            ...item,
            messages: [...item.messages, incoming, ...extra],
            unread: state.activeId === id ? 0 : item.unread + 1,
          })),
        ...state.conversations.filter((item) => item.id !== id),
      ],
    }));
    if (get().activeId !== id) {
      useNotificationsStore.getState().push({
        id: `n-${incoming.id}`,
        kind: "mention",
        actor: undefined,
        companyId: contact.companyId,
        message: `${contact.name} (${channel}): ${body}`,
        at: incoming.at,
        href: "/conversas",
        unread: true,
      });
    }
  },

  simulateIncoming: () => {
    const contacts = useContactsStore.getState().contacts.filter((item) => item.contactability === "Válido");
    const contact = contacts[Math.floor(Math.random() * contacts.length)];
    if (!contact) return;
    const channel: ConversationChannel = contact.consent.whatsapp.granted ? "WhatsApp" : "SMS";
    const body = INCOMING_SAMPLES[Math.floor(Math.random() * INCOMING_SAMPLES.length)];
    get().receive(contact.id, channel, body);
  },
}));
