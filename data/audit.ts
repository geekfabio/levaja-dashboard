export const AUDIT_MODULES = [
  "Clientes",
  "Contactos",
  "Oportunidades",
  "Atividades",
  "Vendas",
  "Cotações",
  "Campanhas",
  "Automações",
  "Tickets",
  "Definições",
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_MODULE_TONES: Record<
  AuditModule,
  "blue" | "purple" | "green" | "amber" | "teal" | "orange" | "red" | "neutral"
> = {
  Clientes: "blue",
  Contactos: "teal",
  Oportunidades: "purple",
  Atividades: "green",
  Vendas: "teal",
  Cotações: "purple",
  Campanhas: "orange",
  Automações: "amber",
  Tickets: "red",
  Definições: "neutral",
};

export const AUDIT_MODULE_ROUTES: Record<AuditModule, string> = {
  Clientes: "/",
  Contactos: "/contactos",
  Oportunidades: "/oportunidades",
  Atividades: "/atividades",
  Vendas: "/vendas",
  Cotações: "/cotacoes",
  Campanhas: "/campanhas",
  Automações: "/automacoes",
  Tickets: "/tickets",
  Definições: "/definicoes",
};

export type EntityRef = {
  module: AuditModule;
  id?: string;
  label: string;
};

export type AuditChange = {
  field: string;
  from?: string;
  to?: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: EntityRef;
  changes: AuditChange[];
  sensitive: boolean;
};

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "au-1",
    at: "2026-10-11T08:42",
    actor: "Sara Neto",
    action: "moveu a oportunidade",
    target: { module: "Oportunidades", id: "op-1", label: "Mercearia Boa Esperança" },
    changes: [{ field: "Fase", from: "Proposta", to: "Negociação" }],
    sensitive: false,
  },
  {
    id: "au-2",
    at: "2026-10-11T08:15",
    actor: "Helena Mateus",
    action: "agendou a campanha",
    target: { module: "Campanhas", id: "cmp-2", label: "Lista de preços — outubro" },
    changes: [{ field: "Estado", from: "Em revisão", to: "Agendada" }],
    sensitive: true,
  },
  {
    id: "au-3",
    at: "2026-10-10T17:20",
    actor: "Marcos Domingos",
    action: "retirou o consentimento de SMS de",
    target: { module: "Contactos", id: "ct-3", label: "Isabel Capinda" },
    changes: [{ field: "Consentimento SMS", from: "Concedido", to: "Retirado" }],
    sensitive: true,
  },
  {
    id: "au-4",
    at: "2026-10-10T15:02",
    actor: "Jaime Teixeira",
    action: "registou uma visita a",
    target: { module: "Clientes", id: "nova-vida", label: "Supermercado Nova Vida" },
    changes: [],
    sensitive: false,
  },
  {
    id: "au-5",
    at: "2026-10-10T11:48",
    actor: "Tiago Fernandes",
    action: "alterou o perfil de",
    target: { module: "Definições", label: "Nádia Jamba" },
    changes: [{ field: "Perfil", from: "Comercial", to: "Gestor comercial" }],
    sensitive: true,
  },
  {
    id: "au-6",
    at: "2026-10-10T09:30",
    actor: "Mariana Capitão",
    action: "abriu o ticket",
    target: { module: "Tickets", id: "tk-3", label: "Reclamação: produto fora do prazo de validade" },
    changes: [{ field: "Prioridade", to: "Urgente" }],
    sensitive: false,
  },
  {
    id: "au-7",
    at: "2026-10-09T16:55",
    actor: "Helena Mateus",
    action: "ativou a automação",
    target: { module: "Automações", id: "aut-2", label: "Reativação de cliente inativo" },
    changes: [{ field: "Estado", from: "Rascunho", to: "Ativa" }],
    sensitive: true,
  },
  {
    id: "au-8",
    at: "2026-10-09T10:12",
    actor: "Alexandre Santos",
    action: "atualizou o cliente",
    target: { module: "Clientes", id: "zango", label: "Revenda Zango" },
    changes: [
      { field: "Valor em carteira", from: "9 000 000 Kz", to: "12 500 000 Kz" },
      { field: "Zona", from: "Luanda", to: "Huambo" },
    ],
    sensitive: true,
  },
];

export const SYSTEM_ACTOR = "Automações";
