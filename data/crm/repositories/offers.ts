import type { DiscountScope } from "@/data/automations";
import type { DiscountOffer } from "@/data/discount-offers";

export type ManualOffer = {
  companyId: string;
  percent: number;
  scope: DiscountScope;
  validDays: number;
};

export interface OffersRepository {
  list(): Promise<DiscountOffer[]>;
  create(input: ManualOffer, today: string): Promise<DiscountOffer>;
  setStatus(id: string, status: "Apresentada" | "Recusada"): Promise<DiscountOffer>;
}
