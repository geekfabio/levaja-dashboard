import type { Activity } from "@/data/activities";
import type { AuditEvent } from "@/data/audit";
import type { Contact } from "@/data/contacts";
import type { Conversation } from "@/data/conversations";

export const ANONYMIZED_NAME = "Contacto anonimizado";

export const DEFAULT_RETENTION_MONTHS = 24;

type ExportSources = {
  activities: Activity[];
  conversations: Conversation[];
  outbox: { contactId?: string; at: string; channel: string; body: string; status: string }[];
  audit: AuditEvent[];
  generatedAt: string;
  generatedBy: string;
};

export function contactDataExport(contact: Contact, sources: ExportSources) {
  return {
    documento: "Exportação de dados pessoais (Lei n.º 22/11 — Proteção de Dados Pessoais)",
    geradoEm: sources.generatedAt,
    geradoPor: sources.generatedBy,
    titular: {
      nome: contact.name,
      cargo: contact.role,
      cliente: contact.companyName,
      telefone: contact.phone,
      whatsapp: contact.whatsapp,
      email: contact.email,
      idioma: contact.preferredLanguage,
      contactabilidade: contact.contactability,
    },
    consentimentos: Object.entries(contact.consent).map(([canal, estado]) => ({
      canal,
      concedido: estado.granted,
      data: estado.date,
      origem: estado.origin,
    })),
    atividades: sources.activities
      .filter((activity) => activity.contactName === contact.name)
      .map((activity) => ({ data: activity.date, tipo: activity.type, nota: activity.note, gestor: activity.owner })),
    conversas: sources.conversations
      .filter((conversation) => conversation.contactId === contact.id)
      .flatMap((conversation) =>
        conversation.messages.map((message) => ({
          canal: conversation.channel,
          data: message.at,
          sentido: message.direction === "in" ? "recebida" : message.direction === "out" ? "enviada" : "sistema",
          texto: message.body,
        })),
      ),
    mensagensEnviadas: sources.outbox
      .filter((record) => record.contactId === contact.id)
      .map((record) => ({ data: record.at, canal: record.channel, texto: record.body, estado: record.status })),
    registoDeAlteracoes: sources.audit
      .filter((event) => event.target.module === "Contactos" && event.target.id === contact.id)
      .map((event) => ({ data: event.at, quem: event.actor, acao: event.action, alteracoes: event.changes })),
  };
}

export function retentionCandidates(
  contacts: Contact[],
  inactiveDays: (companyId: string) => number | undefined,
  months: number,
) {
  const limit = months * 30;
  return contacts
    .filter((contact) => contact.name !== ANONYMIZED_NAME)
    .map((contact) => {
      const days = inactiveDays(contact.companyId);
      const reason =
        contact.contactability === "Pediu remoção"
          ? "Pediu remoção"
          : contact.contactability === "Saiu da empresa"
            ? "Saiu da empresa"
            : days !== undefined && days > limit
              ? `Cliente sem atividade há ${days} dias`
              : undefined;
      return { contact, reason };
    })
    .filter((item): item is { contact: Contact; reason: string } => item.reason !== undefined);
}
