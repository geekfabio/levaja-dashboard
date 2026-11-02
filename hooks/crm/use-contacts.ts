"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { ContactPatch, MergeChoices } from "@/data/crm";
import type { Contact, ContactabilityStatus, ConsentChannel } from "@/data/contacts";
import { diffRecord } from "@/lib/audit";
import { recordEvent } from "@/stores/audit-store";
import { useContactsStore } from "@/stores/contacts-store";

const KEY = ["crm", "contacts"] as const;

const CHANNEL_LABELS: Record<ConsentChannel, string> = { email: "e-mail", sms: "SMS", whatsapp: "WhatsApp" };

const CONTACT_LABELS: Partial<Record<keyof Contact, string>> = {
  name: "Nome",
  role: "Cargo",
  companyName: "Cliente",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

const MERGE_FIELD_LABELS: Record<"role" | "phone" | "whatsapp" | "email", string> = {
  role: "Cargo",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

function ref(contact: Pick<Contact, "id" | "name">) {
  return { module: "Contactos" as const, id: contact.id, label: contact.name };
}

function invalidate(client: QueryClient) {
  return client.invalidateQueries({ queryKey: KEY });
}

export function useContacts() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().contacts.list() });
}

export function useContact(id: string | null) {
  const query = useContacts();
  return { ...query, data: id ? query.data?.find((item) => item.id === id) : undefined };
}

export function useCreateContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (contact: Contact) => repositories().contacts.create(contact),
    onSuccess: (contact) => {
      invalidate(client);
      recordEvent({
        action: "criou o contacto",
        target: ref(contact),
        companyId: contact.companyId,
        sensitive: true,
        toast: {
          title: "Contacto criado",
          description: contact.name,
          tone: "success",
          action: { label: "Abrir", run: () => useContactsStore.getState().openDetail(contact.id) },
        },
      });
    },
  });
}

export function useUpdateContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ContactPatch; previous: Contact }) => repositories().contacts.update(id, patch),
    onSuccess: (contact, { previous }) => {
      invalidate(client);
      const changes = diffRecord(previous, contact, CONTACT_LABELS);
      if (changes.length === 0) return;
      recordEvent({
        action: "atualizou o contacto",
        target: ref(contact),
        companyId: contact.companyId,
        sensitive: true,
        notify: false,
        changes,
        toast: {
          title: "Contacto atualizado",
          description: changes.map((change) => change.field).join(", "),
          tone: "success",
          action: { label: "Anular", run: () => repositories().contacts.restore(previous).then(() => invalidate(client)) },
        },
      });
    },
  });
}

export function useSetContactability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContactabilityStatus; previous: ContactabilityStatus }) => repositories().contacts.setContactability(id, status),
    onSuccess: (contact, { previous }) => {
      invalidate(client);
      if (contact.contactability === previous) return;
      recordEvent({
        action: "alterou o estado de contacto de",
        target: ref(contact),
        companyId: contact.companyId,
        sensitive: true,
        notify: false,
        changes: [{ field: "Contactabilidade", from: previous, to: contact.contactability }],
      });
    },
  });
}

export function useToggleConsent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: ConsentChannel; wasGranted: boolean }) => repositories().contacts.toggleConsent(id, channel),
    onSuccess: (contact, { channel, wasGranted }) => {
      invalidate(client);
      const granted = !wasGranted;
      recordEvent({
        action: `${granted ? "registou" : "retirou"} o consentimento de ${CHANNEL_LABELS[channel]} de`,
        target: ref(contact),
        companyId: contact.companyId,
        sensitive: true,
        notify: false,
        changes: [{ field: `Consentimento ${CHANNEL_LABELS[channel]}`, from: granted ? "Retirado" : "Concedido", to: granted ? "Concedido" : "Retirado" }],
      });
    },
  });
}

export function useMergeContacts() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ primaryId, secondaryId, choices }: { primaryId: string; secondaryId: string; choices: MergeChoices; primary: Contact; secondary: Contact; snapshot: Contact[] }) =>
      repositories().contacts.merge(primaryId, secondaryId, choices),
    onSuccess: ({ merged }, { primary, secondary, snapshot }) => {
      invalidate(client);
      const target = ref(merged);
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
            run: () =>
              repositories()
                .contacts.restoreMerge(snapshot)
                .then(() => {
                  invalidate(client);
                  recordEvent({ action: "anulou a fusão do contacto", target, companyId: primary.companyId, sensitive: true, notify: false });
                }),
          },
        },
      });
    },
  });
}

export function useAnonymizeContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().contacts.anonymize(id),
    onSuccess: (contact) => {
      invalidate(client);
      client.invalidateQueries({ queryKey: ["crm", "conversations"] });
      recordEvent({
        action: "anonimizou os dados pessoais de um contacto de",
        target: { module: "Contactos", id: contact.id, label: contact.companyName },
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
  });
}
