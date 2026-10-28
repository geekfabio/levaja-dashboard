"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { Conversation, ConversationChannel } from "@/data/conversations";
import { recordEvent } from "@/stores/audit-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useConversationsStore } from "@/stores/conversations-store";
import { useNotificationsStore } from "@/stores/notifications-store";

const KEY = ["crm", "conversations"] as const;

export function useConversations() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().conversations.list() });
}

export function useOpenConversation() {
  const client = useQueryClient();
  return (id: string | null) => {
    useConversationsStore.getState().setActiveId(id);
    if (!id) return;
    void repositories()
      .conversations.markRead(id)
      .then(() => client.invalidateQueries({ queryKey: KEY }));
  };
}

export async function startConversation(contactId: string, channel: ConversationChannel) {
  const conversation = await repositories().conversations.start(contactId, channel);
  useConversationsStore.getState().setActiveId(conversation.id);
  return conversation;
}

export function useReplyConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => repositories().conversations.reply(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function useSimulateIncoming() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const contacts = useContactsStore.getState().contacts.filter((item) => item.contactability === "Válido");
      const contact = pick(contacts);
      if (!contact) return null;
      const channel: ConversationChannel = contact.consent.whatsapp.granted ? "WhatsApp" : "SMS";
      const { INCOMING_SAMPLES } = await import("@/data/conversations");
      const body = pick(INCOMING_SAMPLES);
      const result = await repositories().conversations.receive(contact.id, channel, body);
      return { ...result, contact, channel, body };
    },
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: KEY });
      if (!data) return;
      const { conversation, optedOut, contact, channel, body } = data;
      if (optedOut) {
        recordEvent({
          action: `retirou o consentimento de ${channel} de`,
          target: { module: "Contactos", id: contact.id, label: contact.name },
          companyId: contact.companyId,
          sensitive: true,
          notify: false,
        });
        recordEvent({
          action: `retirou o consentimento de ${channel} a pedido (resposta «${body.trim()}») de`,
          target: { module: "Contactos", id: contact.id, label: contact.name },
          companyId: contact.companyId,
          sensitive: true,
          notify: "alert",
        });
        client.invalidateQueries({ queryKey: ["crm", "contacts"] });
      }
      if (useConversationsStore.getState().activeId !== conversation.id) {
        useNotificationsStore.getState().push({
          id: `n-${conversation.id}-${conversation.messages.length}`,
          kind: "mention",
          actor: undefined,
          companyId: contact.companyId,
          message: `${contact.name} (${channel}): ${body}`,
          at: conversation.messages.at(-1)?.at ?? "",
          href: "/conversas",
          unread: true,
        });
      }
    },
  });
}

export type { Conversation };
