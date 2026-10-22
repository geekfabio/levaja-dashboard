import type { FollowUp } from "./follow-ups";
export const SEGMENTS = ["Grossista", "Retalho", "HORECA", "Revendedor"] as const;

export const STAGES = [
  "Novo cliente",
  "Venda adicional",
  "Expansão",
  "Renovação",
  "Piloto",
  "Parceria",
  "Reactivação",
] as const;

export type Segment = (typeof SEGMENTS)[number];
export type Stage = (typeof STAGES)[number];
export type Tag = Segment | Stage;

export type TagTone =
  | "blue"
  | "purple"
  | "green"
  | "moss"
  | "red"
  | "orange"
  | "amber"
  | "teal"
  | "yellow"
  | "neutral";

export const TAG_TONES: Record<Tag, TagTone> = {
  Grossista: "blue",
  Retalho: "moss",
  HORECA: "yellow",
  Revendedor: "red",
  "Novo cliente": "green",
  "Venda adicional": "purple",
  Expansão: "green",
  Renovação: "green",
  Piloto: "orange",
  Parceria: "amber",
  Reactivação: "teal",
};

export const TEAMS = ["Grandes Contas", "Televendas", "Equipa de Rua"] as const;

export type Team = (typeof TEAMS)[number];

export type Owner = {
  name: string;
  avatar: string;
  email: string;
  phone: string;
  role: string;
  team: Team;
};

const AVATARS = Array.from(
  { length: 10 },
  (_, i) => `/assets/images/_common/avatars/avatar-${i + 1}.png`,
);

const OWNER_NAMES = [
  "Sara Neto",
  "Jaime Teixeira",
  "Mariana Capitão",
  "Nádia Jamba",
  "Alexandre Santos",
  "Marcos Domingos",
  "André Kiala",
  "Lina Wamba",
  "Jamile Fonseca",
  "Catarina Sacramento",
  "Ricardo Baptista",
  "Ana Milagre",
  "Emília Garcia",
  "Olívio Chico",
  "Avelina Brito",
  "Nelson Lemos",
  "Graça Miguel",
  "Cloé Pascoal",
];

function emailSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".");
}

function phoneFor(i: number) {
  const number = String(920000000 + i * 37123).padStart(9, "9");
  return `+244 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6, 9)}`;
}

export const OWNERS: Owner[] = OWNER_NAMES.map((name, i) => ({
  name,
  avatar: AVATARS[i % AVATARS.length],
  email: `${emailSlug(name)}@alimentaangola.co.ao`,
  phone: phoneFor(i),
  role: i % 3 === 0 ? "Gestor de Conta Sénior" : "Gestor de Conta",
  team: TEAMS[i % TEAMS.length],
}));

export const CURRENT_USER: Owner = {
  name: "Tiago Fernandes",
  avatar: "/assets/images/_common/avatars/jensen.png",
  email: "tiago.fernandes@alimentaangola.co.ao",
  phone: "+244 923 000 000",
  role: "Diretor Comercial",
  team: "Grandes Contas",
};

export function ownerByName(name: string): Owner {
  return OWNERS.find((owner) => owner.name === name) ?? OWNERS[0];
}

export function profileByName(name: string): Owner {
  return name === CURRENT_USER.name ? CURRENT_USER : ownerByName(name);
}

export const PAYMENT_TERMS = [
  "Pronto pagamento",
  "Crédito a 15 dias",
  "Crédito a 30 dias",
  "Crédito a 60 dias",
] as const;

export type PaymentTerm = (typeof PAYMENT_TERMS)[number];

export type CompanyProfile = {
  nif: string;
  card: string;
  phone: string;
  billingEmail: string;
  address: string;
  municipality: string;
  paymentTerms: PaymentTerm;
  creditLimit: number;
  customerSince: string;
  geo?: { lat: number; lng: number };
};

export const EMPTY_PROFILE: CompanyProfile = {
  nif: "",
  card: "",
  phone: "",
  billingEmail: "",
  address: "",
  municipality: "",
  paymentTerms: "Pronto pagamento",
  creditLimit: 0,
  customerSince: "",
};

export type Company = {
  id: string;
  name: string;
  tags: Tag[];
  owner: string;
  zone: Zone;
  openDeals: number;
  pipelineValue: number;
  winProbability: number;
  trend: number[];
  lastInteraction: { date: string; label: string };
  activityDays: number;
  logo?: string;
  archived?: boolean;
  nextFollowUp?: FollowUp;
  profile?: CompanyProfile;
};

export const TREND_PATTERN = [
  false,
  true,
  true,
  false,
  true,
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  true,
  false,
];

export const DEFAULT_TREND = [4, 4, 5, 5, 2, 7, 11, 7, 5, 7, 5, 3, 7, 14];

const TREND_A = [4, 4, 10, 3, 2, 4, 7, 4, 11, 4, 11, 7, 4, 14];
const TREND_B = [4, 4, 5, 5, 2, 7, 11, 7, 5, 7, 5, 3, 7, 14];
const TREND_C = [4, 4, 10, 5, 2, 7, 11, 7, 11, 7, 11, 7, 7, 14];
const TREND_D = [4, 4, 5, 12, 5, 7, 11, 3, 11, 3, 11, 3, 7, 14];

export const COMPANIES: Company[] = [
  {
    id: "boa-esperanca",
    name: "Mercearia Boa Esperança",
    tags: ["Grossista", "Venda adicional", "Expansão", "Renovação"],
    owner: "Sara Neto",
    zone: "Luanda",
    openDeals: 7,
    pipelineValue: 48_000_000,
    winProbability: 70,
    trend: TREND_A,
    lastInteraction: { date: "2026-02-21", label: "Reunião trimestral" },
    activityDays: 88,
  },
  {
    id: "ilha-cabo",
    name: "Restaurante Ilha do Cabo",
    tags: ["HORECA", "Novo cliente"],
    owner: "Jaime Teixeira",
    zone: "Benguela",
    openDeals: 4,
    pipelineValue: 21_500_000,
    winProbability: 51,
    trend: TREND_B,
    lastInteraction: { date: "2026-02-22", label: "Demonstração" },
    activityDays: 87,
  },
  {
    id: "baia-azul",
    name: "Hotel Baía Azul",
    tags: ["Grossista"],
    owner: "Mariana Capitão",
    zone: "Huíla",
    openDeals: 5,
    pipelineValue: 12_400_000,
    winProbability: 22,
    trend: TREND_C,
    lastInteraction: { date: "2026-03-12", label: "Segurança" },
    activityDays: 84,
  },
  {
    id: "girassol",
    name: "Cantina Girassol",
    tags: ["Renovação"],
    owner: "Nádia Jamba",
    zone: "Huambo",
    openDeals: 2,
    pipelineValue: 18_600_000,
    winProbability: 77,
    trend: TREND_D,
    lastInteraction: { date: "2026-03-17", label: "Jurídico" },
    activityDays: 81,
  },
  {
    id: "tchissola",
    name: "Padaria Tchissola",
    tags: ["Piloto"],
    owner: "Alexandre Santos",
    zone: "Luanda",
    openDeals: 6,
    pipelineValue: 31_000_000,
    winProbability: 82,
    trend: TREND_C,
    lastInteraction: { date: "2026-03-12", label: "Direção" },
    activityDays: 83,
  },
  {
    id: "nova-vida",
    name: "Supermercado Nova Vida",
    tags: ["Revendedor", "Expansão"],
    owner: "Marcos Domingos",
    zone: "Luanda",
    openDeals: 8,
    pipelineValue: 27_700_000,
    winProbability: 86,
    trend: TREND_C,
    lastInteraction: { date: "2026-03-15", label: "Piloto" },
    activityDays: 79,
  },
  {
    id: "miramar",
    name: "Pensão Miramar",
    tags: ["Venda adicional", "Expansão", "HORECA", "Piloto"],
    owner: "André Kiala",
    zone: "Luanda",
    openDeals: 3,
    pipelineValue: 9_900_000,
    winProbability: 51,
    trend: TREND_B,
    lastInteraction: { date: "2026-03-18", label: "Preços" },
    activityDays: 78,
  },
  {
    id: "kilamba",
    name: "Mercearia Kilamba",
    tags: ["Grossista", "Retalho"],
    owner: "Lina Wamba",
    zone: "Luanda",
    openDeals: 5,
    pipelineValue: 19_800_000,
    winProbability: 61,
    trend: TREND_C,
    lastInteraction: { date: "2026-03-28", label: "Produto" },
    activityDays: 74,
  },
  {
    id: "sabores-luanda",
    name: "Restaurante Sabores de Luanda",
    tags: ["Retalho", "Venda adicional", "Renovação", "Parceria"],
    owner: "Jamile Fonseca",
    zone: "Luanda",
    openDeals: 2,
    pipelineValue: 35_900_000,
    winProbability: 38,
    trend: TREND_C,
    lastInteraction: { date: "2026-06-14", label: "Preços" },
    activityDays: 58,
  },
  {
    id: "talatona-plaza",
    name: "Hotel Talatona Plaza",
    tags: ["HORECA", "Grossista", "Expansão", "Piloto"],
    owner: "Catarina Sacramento",
    zone: "Luanda",
    openDeals: 8,
    pipelineValue: 9_600_000,
    winProbability: 24,
    trend: TREND_B,
    lastInteraction: { date: "2026-06-07", label: "Renovação" },
    activityDays: 62,
  },
  {
    id: "esperanca",
    name: "Cantina Esperança",
    tags: ["Retalho"],
    owner: "Ricardo Baptista",
    zone: "Resto do país",
    openDeals: 3,
    pipelineValue: 18_900_000,
    winProbability: 72,
    trend: TREND_C,
    lastInteraction: { date: "2026-06-18", label: "Piloto" },
    activityDays: 55,
  },
  {
    id: "benfica",
    name: "Mercearia Benfica",
    tags: ["Reactivação", "Expansão", "Revendedor"],
    owner: "Ana Milagre",
    zone: "Luanda",
    openDeals: 5,
    pipelineValue: 14_700_000,
    winProbability: 55,
    trend: TREND_C,
    lastInteraction: { date: "2026-07-01", label: "Expansão" },
    activityDays: 48,
  },
  {
    id: "zango",
    name: "Revenda Zango",
    tags: ["Parceria", "Expansão"],
    owner: "Emília Garcia",
    zone: "Luanda",
    openDeals: 9,
    pipelineValue: 11_900_000,
    winProbability: 45,
    trend: TREND_C,
    lastInteraction: { date: "2026-07-18", label: "Renovação" },
    activityDays: 40,
  },
  {
    id: "lobito",
    name: "Instituto Técnico do Lobito",
    tags: ["Expansão", "Reactivação", "Renovação"],
    owner: "Olívio Chico",
    zone: "Benguela",
    openDeals: 8,
    pipelineValue: 24_600_000,
    winProbability: 38,
    trend: TREND_D,
    lastInteraction: { date: "2026-08-08", label: "Parceiro" },
    activityDays: 27,
  },
  {
    id: "marisqueira-ilha",
    name: "Marisqueira da Ilha",
    tags: ["Retalho", "Parceria"],
    owner: "Avelina Brito",
    zone: "Resto do país",
    openDeals: 4,
    pipelineValue: 28_300_000,
    winProbability: 23,
    trend: TREND_C,
    lastInteraction: { date: "2026-08-12", label: "Descoberta" },
    activityDays: 24,
  },
  {
    id: "mussulo-bay",
    name: "Hotel Mussulo Bay",
    tags: ["Expansão", "HORECA", "Venda adicional", "Piloto"],
    owner: "Nelson Lemos",
    zone: "Luanda",
    openDeals: 3,
    pipelineValue: 37_500_000,
    winProbability: 44,
    trend: TREND_C,
    lastInteraction: { date: "2026-09-09", label: "Demonstração" },
    activityDays: 8,
  },
  {
    id: "sao-paulo",
    name: "Mercearia São Paulo",
    tags: ["Grossista", "Retalho"],
    owner: "Graça Miguel",
    zone: "Luanda",
    openDeals: 6,
    pipelineValue: 44_000_000,
    winProbability: 24,
    trend: TREND_C,
    lastInteraction: { date: "2026-09-11", label: "Preços" },
    activityDays: 6,
  },
  {
    id: "cantina-kilamba",
    name: "Cantina Universitária do Kilamba",
    tags: ["Expansão", "Parceria", "Renovação", "Piloto"],
    owner: "Cloé Pascoal",
    zone: "Luanda",
    openDeals: 2,
    pipelineValue: 17_800_000,
    winProbability: 52,
    trend: TREND_C,
    lastInteraction: { date: "2026-09-18", label: "Reunião trimestral" },
    activityDays: 2,
  },
];

export const SORT_OPTIONS = [
  { value: "pipelineValue", label: "Valor em carteira" },
  { value: "winProbability", label: "Probabilidade de fecho" },
  { value: "openDeals", label: "Oportunidades abertas" },
  { value: "lastInteraction", label: "Último contacto" },
  { value: "name", label: "Nome do cliente" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const INTERACTION_TYPES = [
  "Descoberta",
  "Demonstração",
  "Preços",
  "Segurança",
  "Jurídico",
  "Produto",
  "Piloto",
  "Direção",
  "Reunião trimestral",
  "Parceiro",
  "Renovação",
  "Expansão",
] as const;

export const ACTIVITY_WINDOWS = [7, 30, 60, 90] as const;

export type ActivityWindow = (typeof ACTIVITY_WINDOWS)[number];

export const ZONES = [
  "Luanda",
  "Benguela",
  "Huíla",
  "Huambo",
  "Resto do país",
] as const;

export type Zone = string;

export const TREND_WINDOWS = ["Últimos 7 dias", "Últimos 30 dias", "Últimos 90 dias"];

export type ScoreCard = {
  title: string;
  description: string;
  reviewer: string;
  reviewerAvatar: string;
  updated: string;
  verdict: string;
  stars: number;
};

