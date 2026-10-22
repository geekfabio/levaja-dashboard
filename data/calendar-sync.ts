export const CALENDAR_PROVIDERS = [
  {
    id: "google",
    name: "Google Calendar",
    vendor: "Google Workspace ou Gmail",
    logo: "/assets/images/settings/integrations/google-calendar.svg",
    scopes: ["Ver e editar eventos no calendário escolhido", "Criar o calendário «CRM — Alimenta Angola»"],
  },
  {
    id: "outlook",
    name: "Outlook",
    vendor: "Microsoft 365 ou Outlook.com",
    logo: "/assets/images/settings/integrations/outlook-calendar.svg",
    scopes: ["Ler e escrever eventos do calendário (Calendars.ReadWrite)", "Manter o acesso enquanto a ligação estiver ativa"],
  },
  {
    id: "apple",
    name: "Calendário Apple",
    vendor: "iCloud (iPhone, iPad e Mac)",
    logo: "/assets/images/settings/integrations/apple-calendar.svg",
    scopes: ["Subscrever o calendário do CRM por CalDAV com palavra-passe de aplicação", "Só leitura no iPhone: as alterações fazem-se no CRM"],
  },
] as const;

export type CalendarProviderId = (typeof CALENDAR_PROVIDERS)[number]["id"];

export const SYNC_KINDS = [
  { key: "visitas", label: "Visitas" },
  { key: "reunioes", label: "Reuniões" },
  { key: "chamadas", label: "Chamadas e outros contactos" },
  { key: "tarefas", label: "Tarefas com prazo" },
] as const;

export type SyncKind = (typeof SYNC_KINDS)[number]["key"];

export const SYNC_DIRECTIONS = ["Do CRM para o calendário", "Nos dois sentidos"] as const;

export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const CRM_CALENDAR_NAME = "CRM — Alimenta Angola";
