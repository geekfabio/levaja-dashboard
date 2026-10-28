import type { Contact } from "@/data/contacts";
import { useContactsStore } from "@/stores/contacts-store";
import { useConversationsStore } from "@/stores/conversations-store";
import { useMessagingStore } from "@/stores/messaging-store";
import { ANONYMIZED_NAME } from "@/lib/privacy";
import { nowLuandaLocal } from "@/lib/format";
import { RepositoryError } from "../repositories/errors";
import type { ContactsRepository, MergeChoices } from "../repositories/contacts";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function contacts() {
  return useContactsStore.getState().contacts;
}

function setContacts(next: Contact[]) {
  useContactsStore.setState({ contacts: next });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function createMockContacts(latencyMs: number): ContactsRepository {
  function find(id: string) {
    const contact = contacts().find((item) => item.id === id);
    if (!contact) throw new RepositoryError("not_found", "O contacto não existe ou foi removido.");
    return contact;
  }

  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(contacts());
    },

    get: async (id) => {
      await sleep(latencyMs);
      return structuredClone(find(id));
    },

    create: async (contact) => {
      await sleep(latencyMs);
      if (!contact.name.trim()) throw new RepositoryError("validation", "Indique o nome do contacto.", [{ field: "name", message: "Indique o nome do contacto." }]);
      setContacts([contact, ...contacts()]);
      return structuredClone(contact);
    },

    update: async (id, patch) => {
      await sleep(latencyMs);
      find(id);
      const next = contacts().map((item) => (item.id === id ? { ...item, ...patch } : item));
      setContacts(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    restore: async (contact) => {
      await sleep(latencyMs);
      setContacts(contacts().map((item) => (item.id === contact.id ? contact : item)));
      return structuredClone(contact);
    },

    setContactability: async (id, status) => {
      await sleep(latencyMs);
      find(id);
      const next = contacts().map((item) => (item.id === id ? { ...item, contactability: status } : item));
      setContacts(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    toggleConsent: async (id, channel) => {
      await sleep(latencyMs);
      const contact = find(id);
      const next = contacts().map((item) =>
        item.id === id
          ? { ...item, consent: { ...item.consent, [channel]: { granted: !contact.consent[channel].granted, date: today(), origin: "Atualizado manualmente" } } }
          : item,
      );
      setContacts(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    merge: async (primaryId, secondaryId, choices: MergeChoices) => {
      await sleep(latencyMs);
      const primary = find(primaryId);
      const secondary = find(secondaryId);
      const merged: Contact = {
        ...primary,
        role: choices.role === "secondary" ? secondary.role : primary.role,
        phone: choices.phone === "secondary" ? secondary.phone : primary.phone,
        whatsapp: choices.whatsapp === "secondary" ? secondary.whatsapp : primary.whatsapp,
        email: choices.email === "secondary" ? secondary.email : primary.email,
        consent: {
          email: primary.consent.email.granted ? primary.consent.email : secondary.consent.email,
          sms: primary.consent.sms.granted ? primary.consent.sms : secondary.consent.sms,
          whatsapp: primary.consent.whatsapp.granted ? primary.consent.whatsapp : secondary.consent.whatsapp,
        },
      };
      setContacts(
        contacts()
          .map((item) => (item.id === primary.id ? merged : item))
          .filter((item) => item.id !== secondary.id),
      );
      return { merged: structuredClone(merged), removedId: secondary.id };
    },

    restoreMerge: async (snapshot) => {
      await sleep(latencyMs);
      setContacts(snapshot);
      return structuredClone(snapshot);
    },

    anonymize: async (id) => {
      await sleep(latencyMs);
      const contact = find(id);
      if (contact.name === ANONYMIZED_NAME) return structuredClone(contact);
      const revoked = { granted: false, date: nowLuandaLocal().slice(0, 10), origin: "Anonimização (Lei n.º 22/11)" };
      const next = contacts().map((item) =>
        item.id === id
          ? { ...item, name: ANONYMIZED_NAME, role: "—", phone: "", whatsapp: "", email: "", contactability: "Pediu remoção" as const, consent: { email: revoked, sms: revoked, whatsapp: revoked } }
          : item,
      );
      setContacts(next);
      useConversationsStore.setState((state) => ({
        conversations: state.conversations.filter((item) => item.contactId !== id),
        activeId: state.activeId && state.conversations.find((item) => item.id === state.activeId)?.contactId === id ? null : state.activeId,
      }));
      useMessagingStore.setState((state) => ({
        outbox: state.outbox.map((record) => (record.contactId === id ? { ...record, to: "—", toName: ANONYMIZED_NAME, body: "[conteúdo removido]" } : record)),
      }));
      return structuredClone(next.find((item) => item.id === id)!);
    },
  };
}
