export const OPPORTUNITY_STAGES = [
  "Qualificação",
  "Proposta",
  "Negociação",
  "Fechada - Ganha",
  "Fechada - Perdida",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_TONES: Record<
  OpportunityStage,
  "blue" | "amber" | "purple" | "green" | "red"
> = {
  Qualificação: "blue",
  Proposta: "amber",
  Negociação: "purple",
  "Fechada - Ganha": "green",
  "Fechada - Perdida": "red",
};

export const LOSS_REASONS = [
  "Preço",
  "Concorrência",
  "Sem orçamento",
  "Projeto cancelado",
  "Sem resposta",
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export const PRODUCT_CATEGORIES = [
  "Bebidas",
  "Mercearia",
  "Laticínios",
  "Congelados",
  "Higiene",
  "Limpeza",
] as const;

export type StageHistoryEntry = {
  stage: OpportunityStage;
  date: string;
  author: string;
};

export type Opportunity = {
  id: string;
  companyId: string;
  companyName: string;
  contactName: string;
  value: number;
  stage: OpportunityStage;
  probability: number;
  expectedCloseDate: string;
  owner: string;
  products: string[];
  stageHistory: StageHistoryEntry[];
  lossReason?: LossReason;
};

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "op-1",
    companyId: "boa-esperanca",
    companyName: "Mercearia Boa Esperança",
    contactName: "Fernanda Quitumba",
    value: 18_500_000,
    stage: "Negociação",
    probability: 70,
    expectedCloseDate: "2026-10-15",
    owner: "Sara Neto",
    products: ["Mercearia", "Bebidas"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-08-10", author: "Sara Neto" },
      { stage: "Proposta", date: "2026-08-28", author: "Sara Neto" },
      { stage: "Negociação", date: "2026-09-09", author: "Sara Neto" },
    ],
  },
  {
    id: "op-2",
    companyId: "ilha-cabo",
    companyName: "Restaurante Ilha do Cabo",
    contactName: "Manuel Cassoma",
    value: 6_200_000,
    stage: "Qualificação",
    probability: 30,
    expectedCloseDate: "2026-10-28",
    owner: "Jaime Teixeira",
    products: ["Bebidas", "Congelados"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-09-05", author: "Jaime Teixeira" },
    ],
  },
  {
    id: "op-3",
    companyId: "baia-azul",
    companyName: "Hotel Baía Azul",
    contactName: "Isabel Capinda",
    value: 32_000_000,
    stage: "Fechada - Ganha",
    probability: 100,
    expectedCloseDate: "2026-09-10",
    owner: "Mariana Capitão",
    products: ["Mercearia", "Higiene", "Laticínios"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-07-14", author: "Mariana Capitão" },
      { stage: "Proposta", date: "2026-07-30", author: "Mariana Capitão" },
      { stage: "Negociação", date: "2026-08-20", author: "Mariana Capitão" },
      {
        stage: "Fechada - Ganha",
        date: "2026-09-10",
        author: "Mariana Capitão",
      },
    ],
  },
  {
    id: "op-4",
    companyId: "nova-vida",
    companyName: "Supermercado Nova Vida",
    contactName: "Pedro Muanza",
    value: 24_800_000,
    stage: "Negociação",
    probability: 65,
    expectedCloseDate: "2026-11-12",
    owner: "Marcos Domingos",
    products: ["Mercearia", "Limpeza"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-08-18", author: "Marcos Domingos" },
      { stage: "Proposta", date: "2026-09-01", author: "Marcos Domingos" },
      { stage: "Negociação", date: "2026-09-12", author: "Marcos Domingos" },
    ],
  },
  {
    id: "op-5",
    companyId: "tchissola",
    companyName: "Padaria Tchissola",
    contactName: "Joana Capemba",
    value: 4_900_000,
    stage: "Proposta",
    probability: 45,
    expectedCloseDate: "2026-10-06",
    owner: "Alexandre Santos",
    products: ["Mercearia"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-08-25", author: "Alexandre Santos" },
      { stage: "Proposta", date: "2026-09-08", author: "Alexandre Santos" },
    ],
  },
  {
    id: "op-6",
    companyId: "kilamba",
    companyName: "Mercearia Kilamba",
    contactName: "Albino Sachipengo",
    value: 15_300_000,
    stage: "Proposta",
    probability: 50,
    expectedCloseDate: "2026-11-18",
    owner: "Lina Wamba",
    products: ["Bebidas", "Mercearia"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-08-30", author: "Lina Wamba" },
      { stage: "Proposta", date: "2026-09-11", author: "Lina Wamba" },
    ],
  },
  {
    id: "op-7",
    companyId: "talatona-plaza",
    companyName: "Hotel Talatona Plaza",
    contactName: "Rosa Bumba",
    value: 9_700_000,
    stage: "Fechada - Perdida",
    probability: 0,
    expectedCloseDate: "2026-09-05",
    owner: "Catarina Sacramento",
    products: ["Laticínios", "Congelados"],
    stageHistory: [
      {
        stage: "Qualificação",
        date: "2026-07-20",
        author: "Catarina Sacramento",
      },
      { stage: "Proposta", date: "2026-08-05", author: "Catarina Sacramento" },
      {
        stage: "Negociação",
        date: "2026-08-22",
        author: "Catarina Sacramento",
      },
      {
        stage: "Fechada - Perdida",
        date: "2026-09-05",
        author: "Catarina Sacramento",
      },
    ],
    lossReason: "Preço",
  },
  {
    id: "op-8",
    companyId: "zango",
    companyName: "Revenda Zango",
    contactName: "Domingos Kiezi",
    value: 11_100_000,
    stage: "Negociação",
    probability: 60,
    expectedCloseDate: "2026-11-22",
    owner: "Emília Garcia",
    products: ["Mercearia", "Bebidas", "Limpeza"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-08-12", author: "Emília Garcia" },
      { stage: "Proposta", date: "2026-08-27", author: "Emília Garcia" },
      { stage: "Negociação", date: "2026-09-10", author: "Emília Garcia" },
    ],
  },
  {
    id: "op-9",
    companyId: "sao-paulo",
    companyName: "Mercearia São Paulo",
    contactName: "Teresa Mbala",
    value: 21_400_000,
    stage: "Qualificação",
    probability: 35,
    expectedCloseDate: "2026-11-02",
    owner: "Graça Miguel",
    products: ["Mercearia", "Higiene"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-09-08", author: "Graça Miguel" },
    ],
  },
  {
    id: "op-10",
    companyId: "marisqueira-ilha",
    companyName: "Marisqueira da Ilha",
    contactName: "Agostinho Zola",
    value: 7_600_000,
    stage: "Proposta",
    probability: 40,
    expectedCloseDate: "2026-12-01",
    owner: "Avelina Brito",
    products: ["Congelados", "Bebidas"],
    stageHistory: [
      { stage: "Qualificação", date: "2026-08-22", author: "Avelina Brito" },
      { stage: "Proposta", date: "2026-09-06", author: "Avelina Brito" },
    ],
  },
];
