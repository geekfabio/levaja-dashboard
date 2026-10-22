import {
  CUSTOMER_IDENTIFIERS,
  IDENTIFIER_TYPES,
  PAYMENT_METHODS,
  SALE_CHANNELS,
  buildLines,
  lineTotal,
} from "@/data/sales";
import { nowLuandaLocal } from "@/lib/format";
import type { IncomingSale, SalesSource } from "./types";

let documentNumber = 9_100;

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export const mockSalesSource: SalesSource = {
  name: "Sistema de vendas (simulado)",
  mode: "Simulação",
  nextSale: (): IncomingSale => {
    documentNumber += 1;
    const lines = buildLines(Math.random, 0.4 + Math.random() * 1.2);
    const known = Math.random() < 0.85;
    const ids = pick(Object.values(CUSTOMER_IDENTIFIERS));
    const type = pick(IDENTIFIER_TYPES);
    const value = type === "Cartão de cliente" ? ids.card : type === "NIF" ? ids.nif : ids.phone;
    const payment = pick(PAYMENT_METHODS);
    return {
      document: `FR 2026/${documentNumber}`,
      at: nowLuandaLocal(),
      channel: pick(SALE_CHANNELS),
      payment,
      identifier: known
        ? { type, value }
        : Math.random() < 0.5
          ? { type: "NIF", value: String(5_000_000_000 + Math.floor(Math.random() * 999_999)) }
          : undefined,
      lines,
      total: lineTotal(lines),
      paid: payment !== "Crédito",
      source: "Simulação",
    };
  },
};
