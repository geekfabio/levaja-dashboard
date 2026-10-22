import { PRICE_LIST_DISCOUNTS, VAT_RATE, type Product } from "@/data/catalog";
import { SEGMENTS, type Company, type Segment } from "@/data/companies";
import type { DocumentLine, Quote, QuoteStatus } from "@/data/quotes";

export function companySegment(company: Company | undefined): Segment {
  return (company?.tags.find((tag) => (SEGMENTS as readonly string[]).includes(tag)) as Segment) ?? "Retalho";
}

export function priceListDiscount(company: Company | undefined, discounts: Record<Segment, number> = PRICE_LIST_DISCOUNTS) {
  return discounts[companySegment(company)] ?? 0;
}

export function lineNet(line: DocumentLine, listDiscount: number) {
  const gross = line.quantity * line.unitPrice;
  const afterList = gross * (1 - listDiscount / 100);
  return Math.round(afterList * (1 - line.discount / 100));
}

export type DocumentTotals = {
  gross: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
};

export function documentTotals(lines: DocumentLine[], listDiscount: number): DocumentTotals {
  const gross = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const net = lines.reduce((sum, line) => sum + lineNet(line, listDiscount), 0);
  const vat = Math.round((net * VAT_RATE) / 100);
  return { gross, discount: gross - net, net, vat, total: net + vat };
}

export function quoteStatus(quote: Quote, today: string): QuoteStatus {
  if ((quote.status === "Enviada" || quote.status === "Rascunho") && quote.validUntil < today) return "Expirada";
  return quote.status;
}

export function nextNumber(prefix: string, existing: string[], year: string) {
  const numbers = existing
    .filter((value) => value.startsWith(`${prefix} ${year}/`))
    .map((value) => Number(value.split("/")[1]) || 0);
  const next = Math.max(0, ...numbers) + 1;
  return `${prefix} ${year}/${String(next).padStart(4, "0")}`;
}

export function productLine(product: Product, quantity = 1): DocumentLine {
  return {
    id: `l-${crypto.randomUUID().slice(0, 8)}`,
    productId: product.id,
    name: product.name,
    unit: product.unit,
    category: product.category,
    quantity,
    unitPrice: product.price,
    discount: 0,
  };
}
