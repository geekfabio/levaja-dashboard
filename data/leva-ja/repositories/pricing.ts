import type { PricingConfig } from "@/types/leva-ja";

export type PricingUpdate = Pick<PricingConfig, "rules" | "extras" | "platformFee" | "commissionRate" | "roundTo">;

export interface PricingRepository {
  get(): Promise<PricingConfig>;
  update(update: PricingUpdate, reason: string): Promise<PricingConfig>;
}
