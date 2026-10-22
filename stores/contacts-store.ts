import { create } from "zustand";
import {
  CONTACTS,
  type Contact,
  type ConsentChannel,
  type ContactabilityStatus,
} from "@/data/contacts";
import { DEFAULT_FILTERS } from "@/lib/contacts";
import { recordEvent } from "./audit-store";
import { useConversationsStore } from "./conversations-store";
import { useMessagingStore } from "./messaging-store";
import { ANONYMIZED_NAME } from "@/lib/privacy";
import { nowLuandaLocal } from "@/lib/format";
import { diffRecord } from "@/lib/audit";

const CHANNEL_LABELS: Record<ConsentChannel, string> = {
  email: "e-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export type ContactPatch = Partial<
  Pick<Contact, "name" | "role" | "phone" | "whatsapp" | "email" | "companyId" | "companyName">
>;

const CONTACT_LABELS: Partial<Record<keyof Contact, string>> = {
  name: "Nome",
  role: "Cargo",
  companyName: "Cliente",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

export type MergeFieldKey = "role" | "phone" | "whatsapp" | "email";

const MERGE_FIELD_LABELS: Record<MergeFieldKey, string> = {
  role: "Cargo",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

export type MergeChoices = Record<MergeFieldKey, "primary" | "secondary">;

const DEFAULT_MERGE_CHOICES: MergeChoices = {
  role: "primary",
  phone: "primary",
  whatsapp: "primary",
  email: "primary",
};

type ContactsState = {
  contacts: Contact[];
  companyId: string;
  contactability: string;
  search: string;
  detailId: string | null;
  detailOpen: boolean;
  newContactOpen: boolean;
  mergeOpen: boolean;
  mergePrimaryId: string | null;
  mergeSecondaryId: string | null;
  mergeChoices: MergeChoices;
  setCompanyId: (companyId: string) => void;
  setContactability: (contactability: string) => void;
  setSearch: (search: string) => void;
  resetFilters: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setNewContactOpen: (open: boolean) => void;
  addContact: (contact: Contact) => void;
  updateContactability: (id: string, status: ContactabilityStatus) => void;
  updateContact: (id: string, patch: ContactPatch) => void;
  toggleConsent: (id: string, channel: ConsentChannel) => void;
  setMergeOpen: (open: boolean) => void;
  setMergePrimaryId: (id: string | null) => void;
  setMergeSecondaryId: (id: string | null) => void;
  setMergeChoice: (field: MergeFieldKey, winner: "primary" | "secondary") => void;
  confirmMerge: () => void;
  anonymize: (id: string) => void;
};

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: CONTACTS,
  ...DEFAULT_FILTERS,
  detailId: null,
  detailOpen: false,
  newContactOpen: false,
  mergeOpen: false,
  mergePrimaryId: null,
  mergeSecondaryId: null,
  mergeChoices: DEFAULT_MERGE_CHOICES,

  setCompanyId: (companyId) => set({ companyId }),
  setContactability: (contactability) => set({ contactability }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),

  openDetail: (detailId) => set({ detailId, detailOpen: true }),
  closeDetail: () => set({ detailOpen: false }),
  setNewContactOpen: (newContactOpen) => set({ newContactOpen }),

  addContact: (contact) => {
    set((state) => ({
      contacts: [contact, ...state.contacts],
      newContactOpen: false,
    }));
    recordEvent({
      action: "criou o contacto",
      target: { module: "Contactos", id: contact.id, label: contact.name },
      companyId: contact.companyId,
      sensitive: true,
      toast: {
        title: "Contacto criado",
        description: contact.name,
        tone: "success",
        action: { label: "Abrir", run: () => get().openDetail(contact.id) },
      },
    });
  },

  updateContact: (id, patch) => {
    const previous = get().contacts.find((item) => item.id === id);
    if (!previous) return;
    const next = { ...previous, ...patch };
    const changes = diffRecord(previous, next, CONTACT_LABELS);
    if (changes.length === 0) return;
    set((state) => ({
      contacts: state.contacts.map((item) => (item.id === id ? next : item)),
    }));
    recordEvent({
      action: "atualizou o contacto",
      target: { module: "Contactos", id, label: next.name },
      companyId: next.companyId,
      sensitive: true,
      notify: false,
      changes,
      toast: {
        title: "Contacto atualizado",
        description: changes.map((change) => change.field).join(", "),
        tone: "success",
        action: {
          label: "Anular",
          run: () =>
            set((state) => ({
              contacts: state.contacts.map((item) => (item.id === id ? previous : item)),
            })),
        },
      },
    });
  },

  updateContactability: (id, status) => {
    const contact = get().contacts.find((item) => item.id === id);
    if (!contact || contact.contactability === status) return;
    set((state) => ({
      contacts: state.contacts.map((item) =>
        item.id === id ? { ...item, contactability: status } : item,
      ),
    }));
    recordEvent({
      action: "alterou o estado de contacto de",
      target: { module: "Contactos", id, label: contact.name },
      companyId: contact.companyId,
      sensitive: true,
      notify: false,
      changes: [{ field: "Contactabilidade", from: contact.contactability, to: status }],
    });
  },

  toggleConsent: (id, channel) => {
    const contact = get().contacts.find((item) => item.id === id);
    if (!contact) return;
    const granted = !contact.consent[channel].granted;
    recordEvent({
      action: `${granted ? "registou" : "retirou"} o consentimento de ${CHANNEL_LABELS[channel]} de`,
      target: { module: "Contactos", id, label: contact.name },
      companyId: contact.companyId,
      sensitive: true,
      notify: false,
      changes: [
        {
          field: `Consentimento ${CHANNEL_LABELS[channel]}`,
          from: granted ? "Retirado" : "Concedido",
          to: granted ? "Concedido" : "Retirado",
        },
      ],
    });
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              consent: {
                ...contact.consent,
                [channel]: {
                  granted: !contact.consent[channel].granted,
                  date: today(),
                  origin: "Atualizado manualmente",
                },
              },
            }
          : contact,
      ),
    }));
  },

  setMergeOpen: (mergeOpen) =>
    set({
      mergeOpen,
      ...(mergeOpen
        ? {}
        : {
            mergePrimaryId: null,
            mergeSecondaryId: null,
            mergeChoices: DEFAULT_MERGE_CHOICES,
          }),
    }),
  setMergePrimaryId: (mergePrimaryId) => set({ mergePrimaryId }),
  setMergeSecondaryId: (mergeSecondaryId) => set({ mergeSecondaryId }),
  setMergeChoice: (field, winner) =>
    set((state) => ({
      mergeChoices: { ...state.mergeChoices, [field]: winner },
    })),

  confirmMerge: () => {
    const { contacts, mergePrimaryId, mergeSecondaryId, mergeChoices } = get();
    const primary = contacts.find((item) => item.id === mergePrimaryId);
    const secondary = contacts.find((item) => item.id === mergeSecondaryId);
    if (!primary || !secondary) return;

    const merged: Contact = {
      ...primary,
      role: mergeChoices.role === "secondary" ? secondary.role : primary.role,
      phone: mergeChoices.phone === "secondary" ? secondary.phone : primary.phone,
      whatsapp:
        mergeChoices.whatsapp === "secondary"
          ? secondary.whatsapp
          : primary.whatsapp,
      email: mergeChoices.email === "secondary" ? secondary.email : primary.email,
      consent: {
        email: primary.consent.email.granted
          ? primary.consent.email
          : secondary.consent.email,
        sms: primary.consent.sms.granted
          ? primary.consent.sms
          : secondary.consent.sms,
        whatsapp: primary.consent.whatsapp.granted
          ? primary.consent.whatsapp
          : secondary.consent.whatsapp,
      },
    };

    const snapshot = contacts;
    set((state) => ({
      contacts: state.contacts
        .map((item) => (item.id === primary.id ? merged : item))
        .filter((item) => item.id !== secondary.id),
      mergeOpen: false,
      mergePrimaryId: null,
      mergeSecondaryId: null,
      mergeChoices: DEFAULT_MERGE_CHOICES,
    }));

    const target = { module: "Contactos" as const, id: primary.id, label: primary.name };
    recordEvent({
      action: `fundiu ${secondary.name} com o contacto`,
      target,
      companyId: primary.companyId,
      sensitive: true,
      changes: (["role", "phone", "whatsapp", "email"] as const)
        .filter((field) => primary[field] !== merged[field])
        .map((field) => ({ field: MERGE_FIELD_LABELS[field], from: primary[field], to: merged[field] })),
      toast: {
        title: "Contactos fundidos",
        description: `${secondary.name} foi integrado em ${primary.name}.`,
        tone: "success",
        action: {
          label: "Anular",
          run: () => {
            set({ contacts: snapshot });
            recordEvent({
              action: "anulou a fusão do contacto",
              target,
              companyId: primary.companyId,
              sensitive: true,
              notify: false,
            });
          },
        },
      },
    });
  },

  anonymize: (id) => {
    const contact = get().contacts.find((item) => item.id === id);
    if (!contact || contact.name === ANONYMIZED_NAME) return;
    const today = nowLuandaLocal().slice(0, 10);
    const revoked = { granted: false, date: today, origin: "Anonimização (Lei n.º 22/11)" };
    set((state) => ({
      contacts: state.contacts.map((item) =>
        item.id === id
          ? {
              ...item,
              name: ANONYMIZED_NAME,
              role: "—",
              phone: "",
              whatsapp: "",
              email: "",
              contactability: "Pediu remoção",
              consent: { email: revoked, sms: revoked, whatsapp: revoked },
            }
          : item,
      ),
    }));
    useConversationsStore.setState((state) => ({
      conversations: state.conversations.filter((item) => item.contactId !== id),
      activeId: state.activeId && state.conversations.find((item) => item.id === state.activeId)?.contactId === id ? null : state.activeId,
    }));
    useMessagingStore.setState((state) => ({
      outbox: state.outbox.map((record) =>
        record.contactId === id ? { ...record, to: "—", toName: ANONYMIZED_NAME, body: "[conteúdo removido]" } : record,
      ),
    }));
    recordEvent({
      action: "anonimizou os dados pessoais de um contacto de",
      target: { module: "Contactos", id, label: contact.companyName },
      companyId: contact.companyId,
      sensitive: true,
      notify: false,
      changes: [
        { field: "Nome, telefone, e-mail, WhatsApp", to: "Removidos" },
        { field: "Consentimentos", to: "Retirados" },
        { field: "Conversas", to: "Apagadas" },
      ],
      toast: { title: "Contacto anonimizado", description: "Os dados pessoais foram removidos. Esta ação não se pode anular.", tone: "success" },
    });
  },
}));
