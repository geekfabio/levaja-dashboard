import type { Sale } from "@/data/sales";

export type IncomingSale = Omit<Sale, "id" | "companyId">;

export type SalesSource = {
  name: string;
  mode: "Simulação" | "Produção";
  nextSale: () => IncomingSale;
};
