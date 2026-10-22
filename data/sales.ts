import { CATALOG, CATALOG_CATEGORIES } from "./catalog";
import { COMPANIES } from "./companies";

export const SALE_CHANNELS = ["Loja Viana", "Loja Cazenga", "Televendas", "Entrega"] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];

export const PAYMENT_METHODS = ["Multicaixa (TPA)", "Numerário", "Transferência", "Crédito"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_TONES: Record<PaymentMethod, "blue" | "green" | "purple" | "amber"> = {
  "Multicaixa (TPA)": "blue",
  Numerário: "green",
  Transferência: "purple",
  Crédito: "amber",
};

export const IDENTIFIER_TYPES = ["Cartão de cliente", "NIF", "Telefone"] as const;
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

export const PRODUCT_CATEGORIES = CATALOG_CATEGORIES;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type SaleLine = {
  category: ProductCategory;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Sale = {
  id: string;
  document: string;
  at: string;
  channel: SaleChannel;
  payment: PaymentMethod;
  identifier?: { type: IdentifierType; value: string };
  companyId?: string;
  lines: SaleLine[];
  total: number;
  paid: boolean;
  source: "Simulação" | "Sistema de vendas";
};

export type CustomerIdentifiers = {
  card: string;
  nif: string;
  phone: string;
};

export const SALES_ANCHOR = "2026-10-11T18:00";

const PRODUCTS = Object.fromEntries(
  PRODUCT_CATEGORIES.map((category) => [
    category,
    CATALOG.filter((product) => product.category === category).map((product) => ({
      description: product.name,
      price: product.price,
    })),
  ]),
) as Record<ProductCategory, { description: string; price: number }[]>;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], next: () => number) {
  return items[Math.floor(next() * items.length)];
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function shiftLocal(local: string, ms: number) {
  return new Date(Date.parse(`${local}:00Z`) + ms).toISOString().slice(0, 16);
}

export function buildLines(next: () => number, scale: number): SaleLine[] {
  const count = 1 + Math.floor(next() * 4);
  const shuffled = [...PRODUCT_CATEGORIES];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  const categories = shuffled.slice(0, count);
  return categories.map((category) => {
    const product = pick(PRODUCTS[category], next);
    return {
      category,
      description: product.description,
      quantity: Math.max(1, Math.round((2 + next() * 18) * scale)),
      unitPrice: product.price,
    };
  });
}

export function lineTotal(lines: SaleLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export const CUSTOMER_IDENTIFIERS: Record<string, CustomerIdentifiers> = Object.fromEntries(
  COMPANIES.map((company, index) => [
    company.id,
    {
      card: `AA-${String(104_320 + index * 37).padStart(6, "0")}`,
      nif: String(5_417_200_000 + index * 1_013),
      phone: `+244 9${(23 + (index % 7)) % 100} ${String(400_000 + index * 2_311).slice(0, 3)} ${String(100 + index * 17).slice(-3)}`,
    },
  ]),
);

const LAPSED: Record<string, number> = {
  "marisqueira-ilha": 64,
  zango: 47,
  "baia-azul": 38,
  lobito: 92,
  miramar: 33,
};

const CREDIT_CUSTOMERS = new Set(["mussulo-bay", "cantina-kilamba", "lobito", "talatona-plaza", "baia-azul"]);

function seedSales(): Sale[] {
  const next = random(20261011);
  const sales: Sale[] = [];
  let document = 4_812;

  COMPANIES.forEach((company, index) => {
    const lapsedDays = LAPSED[company.id];
    const interval = 4 + (index % 5) * 3;
    const scale = Math.max(0.4, company.pipelineValue / 25_000_000);
    let daysAgo = lapsedDays ?? Math.floor(next() * interval);
    while (daysAgo < 120) {
      const at = shiftLocal(SALES_ANCHOR, -(daysAgo * DAY + Math.floor(next() * 9 * 60) * MINUTE));
      const lines = buildLines(next, scale);
      const credit = CREDIT_CUSTOMERS.has(company.id) && next() < 0.45;
      const payment: PaymentMethod = credit ? "Crédito" : pick(["Multicaixa (TPA)", "Multicaixa (TPA)", "Numerário", "Transferência"] as const, next);
      const identifierType = pick(IDENTIFIER_TYPES, next);
      const ids = CUSTOMER_IDENTIFIERS[company.id];
      sales.push({
        id: `vd-${document}`,
        document: `FR 2026/${document}`,
        at,
        channel: pick(SALE_CHANNELS, next),
        payment,
        identifier: {
          type: identifierType,
          value: identifierType === "Cartão de cliente" ? ids.card : identifierType === "NIF" ? ids.nif : ids.phone,
        },
        companyId: company.id,
        lines,
        total: lineTotal(lines),
        paid: !credit || daysAgo > 45,
        source: "Sistema de vendas",
      });
      document += 1;
      daysAgo += interval + Math.floor(next() * interval);
    }
  });

  const unmatched: Sale[] = (
    [
    {
      id: "vd-por-associar-1",
      document: `FR 2026/${document + 1}`,
      at: shiftLocal(SALES_ANCHOR, -3 * 60 * MINUTE),
      channel: "Loja Viana",
      payment: "Multicaixa (TPA)",
      identifier: { type: "NIF", value: "5000123987" },
      lines: buildLines(next, 0.8),
      total: 0,
      paid: true,
      source: "Sistema de vendas",
    },
    {
      id: "vd-por-associar-2",
      document: `FR 2026/${document + 2}`,
      at: shiftLocal(SALES_ANCHOR, -26 * 60 * MINUTE),
      channel: "Loja Cazenga",
      payment: "Numerário",
      lines: buildLines(next, 0.5),
      total: 0,
      paid: true,
      source: "Sistema de vendas",
    },
    ] satisfies Sale[]
  ).map((sale) => ({ ...sale, total: lineTotal(sale.lines) }));

  return [...sales, ...unmatched].sort((a, b) => b.at.localeCompare(a.at));
}

export const SALES: Sale[] = seedSales();

export const CREDIT_LIMITS: Record<string, number> = {
  "mussulo-bay": 15_000_000,
  "cantina-kilamba": 8_000_000,
  lobito: 6_000_000,
  "talatona-plaza": 12_000_000,
  "baia-azul": 10_000_000,
};
