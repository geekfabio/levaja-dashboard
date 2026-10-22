import type { CatalogCategory } from "./catalog";

export const QUOTE_STATUSES = ["Rascunho", "Enviada", "Aceite", "Recusada", "Expirada", "Convertida"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_TONES: Record<QuoteStatus, "neutral" | "blue" | "green" | "red" | "amber" | "purple"> = {
  Rascunho: "neutral",
  Enviada: "blue",
  Aceite: "green",
  Recusada: "red",
  Expirada: "amber",
  Convertida: "purple",
};

export const ORDER_STATUSES = ["Pendente", "Em preparação", "Entregue", "Cancelada"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_TONES: Record<OrderStatus, "amber" | "blue" | "green" | "neutral"> = {
  Pendente: "amber",
  "Em preparação": "blue",
  Entregue: "green",
  Cancelada: "neutral",
};

export const FULFILMENT_TYPES = ["Entrega", "Levantamento na loja"] as const;

export type FulfilmentType = (typeof FULFILMENT_TYPES)[number];

export type DocumentLine = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  category: CatalogCategory;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type Quote = {
  id: string;
  number: string;
  companyId: string;
  opportunityId?: string;
  owner: string;
  createdAt: string;
  validUntil: string;
  status: QuoteStatus;
  priceListDiscount: number;
  lines: DocumentLine[];
  notes: string;
  orderId?: string;
};

export type Order = {
  id: string;
  number: string;
  companyId: string;
  quoteId?: string;
  owner: string;
  createdAt: string;
  deliveryDate: string;
  fulfilment: FulfilmentType;
  status: OrderStatus;
  lines: DocumentLine[];
  priceListDiscount: number;
  notes: string;
  saleDocument?: string;
};

function line(id: string, productId: string, name: string, unit: string, category: CatalogCategory, quantity: number, unitPrice: number, discount = 0): DocumentLine {
  return { id, productId, name, unit, category, quantity, unitPrice, discount };
}

export const QUOTES: Quote[] = [
  {
    id: "cot-1",
    number: "COT 2026/0041",
    companyId: "ilha-cabo",
    opportunityId: "op-2",
    owner: "Jaime Teixeira",
    createdAt: "2026-10-08",
    validUntil: "2026-10-23",
    status: "Enviada",
    priceListDiscount: 3,
    lines: [
      line("l1", "BEB-002", "Refrigerante 33 cl (grade 24)", "grade", "Bebidas", 120, 9_800),
      line("l2", "BEB-001", "Água mineral 1,5 L (pack 6)", "pack", "Bebidas", 300, 1_900, 2),
      line("l3", "CON-001", "Coxas de frango 10 kg", "caixa", "Congelados", 40, 24_500),
    ],
    notes: "Entrega semanal às segundas-feiras.",
  },
  {
    id: "cot-2",
    number: "COT 2026/0042",
    companyId: "boa-esperanca",
    owner: "Sara Neto",
    createdAt: "2026-10-09",
    validUntil: "2026-10-24",
    status: "Rascunho",
    priceListDiscount: 4,
    lines: [
      line("l1", "MER-001", "Açúcar 25 kg", "saco", "Mercearia", 30, 32_500),
      line("l2", "OLE-001", "Óleo alimentar 20 L", "bidão", "Óleos e gorduras", 20, 46_000),
    ],
    notes: "",
  },
  {
    id: "cot-3",
    number: "COT 2026/0038",
    companyId: "cantina-kilamba",
    owner: "Graça Miguel",
    createdAt: "2026-09-29",
    validUntil: "2026-10-14",
    status: "Convertida",
    priceListDiscount: 3,
    lines: [
      line("l1", "ARR-001", "Arroz agulha 25 kg", "saco", "Arroz e massas", 80, 29_900),
      line("l2", "MER-003", "Feijão manteiga 25 kg", "saco", "Mercearia", 40, 38_000),
      line("l3", "OLE-001", "Óleo alimentar 20 L", "bidão", "Óleos e gorduras", 25, 46_000, 3),
    ],
    notes: "Fornecimento mensal da cantina.",
    orderId: "enc-1",
  },
  {
    id: "cot-4",
    number: "COT 2026/0035",
    companyId: "sao-paulo",
    owner: "Sara Neto",
    createdAt: "2026-09-18",
    validUntil: "2026-10-03",
    status: "Recusada",
    priceListDiscount: 0,
    lines: [line("l1", "LAT-001", "Leite UHT 1 L (caixa 12)", "caixa", "Laticínios", 60, 13_200)],
    notes: "Cliente achou o preço acima da concorrência.",
  },
];

export const ORDERS: Order[] = [
  {
    id: "enc-1",
    number: "ENC 2026/0017",
    companyId: "cantina-kilamba",
    quoteId: "cot-3",
    owner: "Graça Miguel",
    createdAt: "2026-10-02",
    deliveryDate: "2026-10-14",
    fulfilment: "Entrega",
    status: "Em preparação",
    lines: QUOTES[2].lines,
    priceListDiscount: 3,
    notes: "Fornecimento mensal da cantina.",
  },
  {
    id: "enc-2",
    number: "ENC 2026/0016",
    companyId: "nova-vida",
    owner: "Marcos Domingos",
    createdAt: "2026-09-30",
    deliveryDate: "2026-10-03",
    fulfilment: "Levantamento na loja",
    status: "Entregue",
    lines: [
      line("l1", "BEB-003", "Sumo 1 L (caixa 12)", "caixa", "Bebidas", 50, 14_400),
      line("l2", "HIG-001", "Detergente 5 L", "garrafão", "Higiene e limpeza", 40, 6_800),
    ],
    priceListDiscount: 4,
    notes: "",
    saleDocument: "FR 2026/4702",
  },
];
