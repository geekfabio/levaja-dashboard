import type { DiscountScope } from "./automations";
import type { ProductCategory } from "./sales";

export const OFFER_STATUSES = [
  "Por apresentar",
  "Apresentada",
  "Aproveitada",
  "Recusada",
  "Expirada",
  "Substituída",
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_STATUS_TONES: Record<OfferStatus, "amber" | "blue" | "green" | "red" | "neutral"> = {
  "Por apresentar": "amber",
  Apresentada: "blue",
  Aproveitada: "green",
  Recusada: "red",
  Expirada: "neutral",
  Substituída: "neutral",
};

export const OPEN_OFFER_STATUSES: OfferStatus[] = ["Por apresentar", "Apresentada"];

export type DiscountOffer = {
  id: string;
  companyId: string;
  percent: number;
  scope: DiscountScope;
  categories: ProductCategory[];
  createdAt: string;
  validUntil: string;
  status: OfferStatus;
  owner: string;
  origin: string;
  automationId?: string;
  daysWithoutPurchase?: number;
  saleId?: string;
  saleDocument?: string;
  saleTotal?: number;
  discountValue?: number;
};

export const DISCOUNT_OFFERS: DiscountOffer[] = [
  {
    id: "of-1",
    companyId: "nova-vida",
    percent: 5,
    scope: "Categorias habituais",
    categories: ["Mercearia", "Bebidas"],
    createdAt: "2026-09-08T09:00",
    validUntil: "2026-09-22",
    status: "Aproveitada",
    owner: "Marcos Domingos",
    origin: "Marcos Domingos",
    daysWithoutPurchase: 34,
    saleDocument: "FR 2026/4410",
    saleTotal: 1_284_000,
    discountValue: 48_600,
  },
  {
    id: "of-2",
    companyId: "sao-paulo",
    percent: 7,
    scope: "Toda a encomenda",
    categories: [],
    createdAt: "2026-09-15T10:30",
    validUntil: "2026-09-29",
    status: "Recusada",
    owner: "Sara Neto",
    origin: "Sara Neto",
    daysWithoutPurchase: 31,
  },
];
