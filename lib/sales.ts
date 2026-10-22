import type { AbcClass } from "@/data/campaigns";
import type { Company } from "@/data/companies";
import {
  type CustomerIdentifiers,
  type IdentifierType,
  type ProductCategory,
  type Sale,
} from "@/data/sales";

const DAY = 24 * 60 * 60 * 1000;

export const ABC_WINDOW_DAYS = 90;
export const OVERDUE_CREDIT_DAYS = 30;

function digits(value: string) {
  return value.replace(/\D/g, "").replace(/^244(?=9\d{8}$)/, "");
}

export function matchCustomer(
  identifier: Sale["identifier"],
  identifiers: Record<string, CustomerIdentifiers>,
  order: IdentifierType[],
) {
  if (!identifier || !order.includes(identifier.type)) return undefined;
  const wanted = identifier.type === "Cartão de cliente" ? identifier.value.trim().toUpperCase() : digits(identifier.value);
  return Object.entries(identifiers).find(([, ids]) => {
    if (identifier.type === "Cartão de cliente") return ids.card.toUpperCase() === wanted;
    if (identifier.type === "NIF") return digits(ids.nif) === wanted;
    return digits(ids.phone) === wanted;
  })?.[0];
}

function daysBetween(fromLocal: string, toLocal: string) {
  return Math.max(0, Math.floor((Date.parse(`${toLocal.slice(0, 10)}T00:00:00Z`) - Date.parse(`${fromLocal.slice(0, 10)}T00:00:00Z`)) / DAY));
}

export type PurchaseStats = {
  count: number;
  volume: number;
  averageTicket: number;
  lastPurchaseAt?: string;
  daysSincePurchase?: number;
  usualInterval?: number;
  atRisk: boolean;
  debt: number;
  overdueDebt: number;
  creditLimit?: number;
  topCategories: ProductCategory[];
};

export function purchaseStats(sales: Sale[], companyId: string, today: string, creditLimit?: number): PurchaseStats {
  const own = sales
    .filter((sale) => sale.companyId === companyId)
    .sort((a, b) => a.at.localeCompare(b.at));
  const windowStart = Date.parse(`${today}T00:00:00Z`) - ABC_WINDOW_DAYS * DAY;
  const recent = own.filter((sale) => Date.parse(`${sale.at}:00Z`) >= windowStart);
  const volume = recent.reduce((sum, sale) => sum + sale.total, 0);
  const last = own[own.length - 1];
  const intervals = own.slice(1).map((sale, index) => daysBetween(own[index].at, sale.at));
  const usualInterval = intervals.length
    ? Math.max(1, Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length))
    : undefined;
  const daysSincePurchase = last ? daysBetween(last.at, today) : undefined;
  const unpaid = own.filter((sale) => sale.payment === "Crédito" && !sale.paid);
  const debt = unpaid.reduce((sum, sale) => sum + sale.total, 0);
  const overdueDebt = unpaid
    .filter((sale) => daysBetween(sale.at, today) > OVERDUE_CREDIT_DAYS)
    .reduce((sum, sale) => sum + sale.total, 0);

  const categoryTotals = new Map<ProductCategory, number>();
  for (const sale of recent) {
    for (const line of sale.lines) {
      categoryTotals.set(line.category, (categoryTotals.get(line.category) ?? 0) + line.quantity * line.unitPrice);
    }
  }

  return {
    count: recent.length,
    volume,
    averageTicket: recent.length ? Math.round(volume / recent.length) : 0,
    lastPurchaseAt: last?.at,
    daysSincePurchase,
    usualInterval,
    atRisk:
      daysSincePurchase !== undefined &&
      ((usualInterval !== undefined && daysSincePurchase > Math.max(usualInterval * 2, 14)) || daysSincePurchase > 45),
    debt,
    overdueDebt,
    creditLimit: creditLimit || undefined,
    topCategories: [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category]) => category),
  };
}

export function abcBySales(companies: Company[], sales: Sale[], today: string): Map<string, AbcClass> {
  const windowStart = Date.parse(`${today}T00:00:00Z`) - ABC_WINDOW_DAYS * DAY;
  const volumes = new Map<string, number>(companies.map((company) => [company.id, 0]));
  for (const sale of sales) {
    if (!sale.companyId || !volumes.has(sale.companyId)) continue;
    if (Date.parse(`${sale.at}:00Z`) < windowStart) continue;
    volumes.set(sale.companyId, (volumes.get(sale.companyId) ?? 0) + sale.total);
  }
  const sorted = [...volumes.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, value]) => sum + value, 0) || 1;
  const classes = new Map<string, AbcClass>();
  let cumulative = 0;
  for (const [id, value] of sorted) {
    const share = cumulative / total;
    classes.set(id, share < 0.8 ? "A" : share < 0.95 ? "B" : "C");
    cumulative += value;
  }
  return classes;
}

export function salesInWindow(sales: Sale[], days: number, today: string) {
  const start = Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY;
  return sales.filter((sale) => Date.parse(`${sale.at.slice(0, 10)}T00:00:00Z`) >= start);
}

export function salesCsvRows(sales: Sale[], companyName: (id?: string) => string) {
  return [
    ["Documento", "Data", "Cliente", "Canal", "Pagamento", "Identificação", "Total (Kz)", "Pago"],
    ...sales.map((sale) => [
      sale.document,
      sale.at.replace("T", " "),
      companyName(sale.companyId),
      sale.channel,
      sale.payment,
      sale.identifier ? `${sale.identifier.type}: ${sale.identifier.value}` : "—",
      sale.total,
      sale.paid ? "Sim" : "Não",
    ]),
  ];
}
