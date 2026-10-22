import type { AbcClass } from "@/data/campaigns";
import type { Company, Segment } from "@/data/companies";
import type { Order, Quote } from "@/data/quotes";
import {
  PAYMENT_METHODS,
  PRODUCT_CATEGORIES,
  SALE_CHANNELS,
  type PaymentMethod,
  type ProductCategory,
  type Sale,
  type SaleChannel,
} from "@/data/sales";
import { addDays } from "./follow-up";
import { documentTotals } from "./quotes";
import { abcBySales, purchaseStats } from "./sales";

export const ANY = "all";

export type AnalyticsFilters = {
  days: number;
  zone: string;
  segment: string;
};

export type DateRange = { from: string; to: string };

export function periodRanges(today: string, days: number): { current: DateRange; previous: DateRange } {
  const from = addDays(today, -(days - 1));
  return {
    current: { from, to: today },
    previous: { from: addDays(from, -days), to: addDays(from, -1) },
  };
}

export function scopeSales(sales: Sale[], companies: Company[], filters: Pick<AnalyticsFilters, "zone" | "segment">) {
  if (filters.zone === ANY && filters.segment === ANY) return sales;
  const allowed = new Set(
    companies
      .filter(
        (company) =>
          (filters.zone === ANY || company.zone === filters.zone) &&
          (filters.segment === ANY || company.tags.includes(filters.segment as Segment)),
      )
      .map((company) => company.id),
  );
  return sales.filter((sale) => sale.companyId && allowed.has(sale.companyId));
}

export function inRange(sales: Sale[], range: DateRange) {
  return sales.filter((sale) => {
    const day = sale.at.slice(0, 10);
    return day >= range.from && day <= range.to;
  });
}

export function salesSummary(sales: Sale[]) {
  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  return {
    total,
    count: sales.length,
    averageTicket: sales.length ? Math.round(total / sales.length) : 0,
    buyers: new Set(sales.map((sale) => sale.companyId).filter(Boolean)).size,
  };
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export type DailyPoint = { date: string; total: number; count: number; average: number };

export function dailySeries(sales: Sale[], range: DateRange, window = 7): DailyPoint[] {
  const totals = new Map<string, { total: number; count: number }>();
  for (const sale of sales) {
    const day = sale.at.slice(0, 10);
    const entry = totals.get(day) ?? { total: 0, count: 0 };
    entry.total += sale.total;
    entry.count += 1;
    totals.set(day, entry);
  }
  const points: DailyPoint[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    const entry = totals.get(day) ?? { total: 0, count: 0 };
    points.push({ date: day, ...entry, average: 0 });
  }
  points.forEach((point, index) => {
    const slice = points.slice(Math.max(0, index - window + 1), index + 1);
    point.average = Math.round(slice.reduce((sum, item) => sum + item.total, 0) / slice.length);
  });
  return points;
}

function weekStart(day: string) {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

export type ChannelWeek = { week: string; values: Record<SaleChannel, number>; total: number };

export function weeklyByChannel(sales: Sale[], range: DateRange): ChannelWeek[] {
  const weeks: ChannelWeek[] = [];
  for (let week = weekStart(range.from); week <= range.to; week = addDays(week, 7)) {
    weeks.push({
      week,
      values: Object.fromEntries(SALE_CHANNELS.map((channel) => [channel, 0])) as Record<SaleChannel, number>,
      total: 0,
    });
  }
  for (const sale of sales) {
    const entry = weeks.find((item) => item.week === weekStart(sale.at.slice(0, 10)));
    if (!entry) continue;
    entry.values[sale.channel] += sale.total;
    entry.total += sale.total;
  }
  return weeks;
}

export const HEATMAP_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
export const HEATMAP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

export type HeatCell = { day: number; hour: number; count: number; total: number };

export function weekdayHourHeatmap(sales: Sale[]): HeatCell[] {
  const cells: HeatCell[] = HEATMAP_DAYS.flatMap((_, day) =>
    HEATMAP_HOURS.map((hour) => ({ day, hour, count: 0, total: 0 })),
  );
  for (const sale of sales) {
    const day = (new Date(`${sale.at.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7;
    const hour = Number(sale.at.slice(11, 13));
    const cell = cells.find((item) => item.day === day && item.hour === hour);
    if (!cell) continue;
    cell.count += 1;
    cell.total += sale.total;
  }
  return cells;
}

export type Share<K extends string> = { key: K; total: number; count: number; share: number };

function shares<K extends string>(keys: readonly K[], pick: (sale: Sale) => { key: K; amount: number }[], sales: Sale[]): Share<K>[] {
  const totals = new Map<K, { total: number; count: number }>(keys.map((key) => [key, { total: 0, count: 0 }]));
  for (const sale of sales) {
    for (const { key, amount } of pick(sale)) {
      const entry = totals.get(key)!;
      entry.total += amount;
      entry.count += 1;
    }
  }
  const grand = [...totals.values()].reduce((sum, entry) => sum + entry.total, 0) || 1;
  return keys.map((key) => ({ key, ...totals.get(key)!, share: totals.get(key)!.total / grand }));
}

export function paymentMix(sales: Sale[]): Share<PaymentMethod>[] {
  return shares(PAYMENT_METHODS, (sale) => [{ key: sale.payment, amount: sale.total }], sales);
}

export function categoryRevenue(sales: Sale[]): Share<ProductCategory>[] {
  return shares(
    PRODUCT_CATEGORIES,
    (sale) => sale.lines.map((line) => ({ key: line.category, amount: line.quantity * line.unitPrice })),
    sales,
  ).sort((a, b) => b.total - a.total);
}

export type ZoneChange = { zone: string; current: number; previous: number; change: number | null };

export function zoneComparison(current: Sale[], previous: Sale[], companies: Company[], zones: string[]): ZoneChange[] {
  const zoneOf = new Map(companies.map((company) => [company.id, company.zone]));
  const sum = (sales: Sale[], zone: string) =>
    sales.filter((sale) => sale.companyId && zoneOf.get(sale.companyId) === zone).reduce((total, sale) => total + sale.total, 0);
  return zones
    .map((zone) => {
      const now = sum(current, zone);
      const before = sum(previous, zone);
      return { zone, current: now, previous: before, change: percentChange(now, before) };
    })
    .filter((item) => item.current > 0 || item.previous > 0);
}

export type ClientPoint = {
  company: Company;
  recency: number;
  volume: number;
  count: number;
  abc: AbcClass;
};

export function clientMatrix(companies: Company[], sales: Sale[], today: string): ClientPoint[] {
  const active = companies.filter((company) => !company.archived);
  const abc = abcBySales(active, sales, today);
  return active.flatMap((company) => {
    const stats = purchaseStats(sales, company.id, today);
    if (stats.daysSincePurchase === undefined) return [];
    return [{ company, recency: stats.daysSincePurchase, volume: stats.volume, count: stats.count, abc: abc.get(company.id) ?? "C" }];
  });
}

export const DEBT_BUCKETS = [
  { key: "0-30", label: "Até 30 dias", min: 0, max: 30 },
  { key: "31-60", label: "31 a 60 dias", min: 31, max: 60 },
  { key: "61-90", label: "61 a 90 dias", min: 61, max: 90 },
  { key: "90+", label: "Mais de 90 dias", min: 91, max: Infinity },
] as const;

export type DebtBucket = { key: string; label: string; total: number; count: number };

export function debtAging(sales: Sale[], today: string): DebtBucket[] {
  const buckets: DebtBucket[] = DEBT_BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label, total: 0, count: 0 }));
  for (const sale of sales) {
    if (sale.payment !== "Crédito" || sale.paid) continue;
    const age = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sale.at.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
    const index = DEBT_BUCKETS.findIndex((bucket) => age >= bucket.min && age <= bucket.max);
    const bucket = buckets[Math.max(0, index)];
    bucket.total += sale.total;
    bucket.count += 1;
  }
  return buckets;
}

export type FunnelStep = { key: string; label: string; count: number; value: number };

export function quoteFunnel(quotes: Quote[], orders: Order[]): FunnelStep[] {
  const value = (lines: Quote["lines"], discount: number) => documentTotals(lines, discount).total;
  const sent = quotes.filter((quote) => quote.status !== "Rascunho");
  const accepted = quotes.filter((quote) => quote.status === "Aceite" || quote.status === "Convertida");
  const delivered = orders.filter((order) => order.status === "Entregue");
  return [
    { key: "criadas", label: "Cotações criadas", count: quotes.length, value: quotes.reduce((sum, quote) => sum + value(quote.lines, quote.priceListDiscount), 0) },
    { key: "enviadas", label: "Enviadas ao cliente", count: sent.length, value: sent.reduce((sum, quote) => sum + value(quote.lines, quote.priceListDiscount), 0) },
    { key: "aceites", label: "Aceites", count: accepted.length, value: accepted.reduce((sum, quote) => sum + value(quote.lines, quote.priceListDiscount), 0) },
    { key: "encomendas", label: "Encomendas", count: orders.length, value: orders.reduce((sum, order) => sum + value(order.lines, order.priceListDiscount), 0) },
    { key: "entregues", label: "Entregues", count: delivered.length, value: delivered.reduce((sum, order) => sum + value(order.lines, order.priceListDiscount), 0) },
  ];
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function isNiceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = Number((value / magnitude).toFixed(6));
  return [1, 2, 2.5, 5, 10].includes(normalized);
}

export function axisTicks(max: number) {
  const parts = isNiceStep(max / 4) ? 4 : 5;
  return Array.from({ length: parts + 1 }, (_, index) => (max / parts) * index);
}
