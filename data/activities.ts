import { COMPANIES, type Zone } from "./companies";

export type ActivityType =
  | "Visita"
  | "Chamada"
  | "E-mail"
  | "Reunião"
  | "Entrega"
  | "Reclamação"
  | "WhatsApp";

export const ACTIVITY_TYPES: ActivityType[] = [
  "Visita",
  "Chamada",
  "E-mail",
  "Reunião",
  "Entrega",
  "Reclamação",
  "WhatsApp",
];

export const ACTIVITY_TONES: Record<
  ActivityType,
  "blue" | "purple" | "green" | "amber" | "teal" | "red"
> = {
  Visita: "blue",
  Chamada: "purple",
  "E-mail": "teal",
  Reunião: "amber",
  Entrega: "green",
  Reclamação: "red",
  WhatsApp: "green",
};

export type Activity = {
  id: string;
  type: ActivityType;
  companyId: string;
  companyName: string;
  contactName?: string;
  owner: string;
  zone: Zone;
  date: string;
  note: string;
  checkIn?: CheckIn;
  pendingSync?: boolean;
};

export type CheckIn = {
  at: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance?: number;
};

function company(id: string) {
  return COMPANIES.find((item) => item.id === id)!;
}

function named(
  id: string,
  rest: Omit<Activity, "id" | "companyId" | "companyName">,
): Activity {
  return { id, companyId: id, companyName: company(id).name, ...rest };
}

export const ACTIVITIES: Activity[] = [
  named("boa-esperanca", {
    type: "Visita",
    owner: "Sara Neto",
    zone: "Luanda",
    date: "2026-10-09",
    note: "Visita de rotina, confirmado reabastecimento de bebidas.",
  }),
  named("nova-vida", {
    type: "Entrega",
    owner: "Marcos Domingos",
    zone: "Luanda",
    date: "2026-10-09",
    note: "Entrega mensal confirmada, assinatura recebida no armazém.",
  }),
  named("kilamba", {
    type: "Chamada",
    owner: "Lina Wamba",
    zone: "Luanda",
    date: "2026-10-09",
    note: "Confirmação da encomenda do próximo trimestre.",
  }),
  named("ilha-cabo", {
    type: "Chamada",
    owner: "Jaime Teixeira",
    zone: "Benguela",
    date: "2026-10-05",
    note: "Negociação de condições de pagamento para o próximo trimestre.",
  }),
  named("baia-azul", {
    type: "Entrega",
    owner: "Mariana Capitão",
    zone: "Huíla",
    date: "2026-10-04",
    note: "Entrega de encomenda mensal de mercearia e bebidas.",
  }),
  named("girassol", {
    type: "Reclamação",
    owner: "Nádia Jamba",
    zone: "Huambo",
    date: "2026-10-03",
    note: "Produto danificado na última entrega; crédito emitido.",
  }),
  named("tchissola", {
    type: "E-mail",
    owner: "Alexandre Santos",
    zone: "Luanda",
    date: "2026-10-02",
    note: "Envio da lista de preços atualizada para outubro.",
  }),
  named("sao-paulo", {
    type: "Reunião",
    owner: "Graça Miguel",
    zone: "Luanda",
    date: "2026-10-01",
    note: "Reunião trimestral de revisão de carteira.",
  }),
  named("talatona-plaza", {
    type: "Visita",
    owner: "Catarina Sacramento",
    zone: "Luanda",
    contactName: "Catarina Sacramento",
    date: "2026-09-29",
    note: "Apresentação de novos produtos da gama institucional.",
  }),
  named("zango", {
    type: "Chamada",
    owner: "Emília Garcia",
    zone: "Luanda",
    date: "2026-09-27",
    note: "Confirmação de parceria para distribuição na zona.",
  }),
  named("esperanca", {
    type: "Visita",
    owner: "Ricardo Baptista",
    zone: "Resto do país",
    date: "2026-09-24",
    note: "Visita de prospeção, avaliação de capacidade de armazém.",
  }),
  named("mussulo-bay", {
    type: "Reunião",
    owner: "Nelson Lemos",
    zone: "Luanda",
    date: "2026-09-20",
    note: "Demonstração da gama de bebidas premium à direção.",
  }),
  named("lobito", {
    type: "Entrega",
    owner: "Olívio Chico",
    zone: "Benguela",
    date: "2026-09-15",
    note: "Primeira entrega institucional, confirmada sem incidentes.",
  }),
  named("marisqueira-ilha", {
    type: "Reclamação",
    owner: "Avelina Brito",
    zone: "Resto do país",
    date: "2026-09-10",
    note: "Atraso na entrega reportado; reagendada para a semana seguinte.",
  }),
];
