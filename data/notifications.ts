import type { EntityRef } from "./audit";

export type NotificationKind =
  | "mention"
  | "stage"
  | "alert"
  | "update"
  | "invite";

export type Notification = {
  id: string;
  kind: NotificationKind;
  actor?: string;
  companyId?: string;
  message: string;
  quote?: string;
  at: string;
  target?: EntityRef;
  href?: string;
  unread: boolean;
};

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    kind: "mention",
    actor: "Marcos Domingos",
    companyId: "nova-vida",
    message: "mencionou-te no Supermercado Nova Vida",
    quote:
      "Podes juntar-te à revisão do piloto na sexta? A direção quer uma avaliação de segurança.",
    at: "2026-10-11T09:05",
    target: { module: "Clientes", id: "nova-vida", label: "Supermercado Nova Vida" },
    unread: true,
  },
  {
    id: "n2",
    kind: "stage",
    actor: "Sara Neto",
    companyId: "boa-esperanca",
    message: "moveu a Mercearia Boa Esperança para Negociação",
    at: "2026-10-11T08:42",
    target: { module: "Oportunidades", id: "op-1", label: "Mercearia Boa Esperança" },
    unread: true,
  },
  {
    id: "n3",
    kind: "alert",
    companyId: "marisqueira-ilha",
    message: "A probabilidade de fecho da Marisqueira da Ilha desceu para 23%",
    at: "2026-10-11T07:30",
    target: { module: "Clientes", id: "marisqueira-ilha", label: "Marisqueira da Ilha" },
    unread: true,
  },
  {
    id: "n4",
    kind: "update",
    actor: "Emília Garcia",
    companyId: "zango",
    message: "atualizou a adequação ao negócio da Revenda Zango",
    at: "2026-10-10T16:10",
    target: { module: "Clientes", id: "zango", label: "Revenda Zango" },
    unread: false,
  },
  {
    id: "n5",
    kind: "update",
    actor: "Nelson Lemos",
    companyId: "mussulo-bay",
    message: "registou uma demonstração com o Hotel Mussulo Bay",
    at: "2026-10-10T11:00",
    target: { module: "Clientes", id: "mussulo-bay", label: "Hotel Mussulo Bay" },
    unread: false,
  },
  {
    id: "n6",
    kind: "alert",
    companyId: "sao-paulo",
    message: "O valor em carteira da Mercearia São Paulo subiu para 44.000.000 Kz",
    at: "2026-10-09T14:20",
    target: { module: "Clientes", id: "sao-paulo", label: "Mercearia São Paulo" },
    unread: false,
  },
  {
    id: "n7",
    kind: "invite",
    actor: "Graça Miguel",
    companyId: "cantina-kilamba",
    message: "adicionou-te à equipa da Cantina Universitária do Kilamba",
    at: "2026-10-08T10:45",
    target: { module: "Clientes", id: "cantina-kilamba", label: "Cantina Universitária do Kilamba" },
    unread: false,
  },
];
