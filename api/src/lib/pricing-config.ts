import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { platformSettings } from "../db/schema/admin";

export const PRICING_SETTINGS_KEY = "pricing";

export type PricingRuleKind = "tow" | "cargo" | "small_move" | "house_move";

export type PricingConfig = {
  rules: { kind: PricingRuleKind; base: number; per_km: number }[];
  extras: { id: string; label: string; amount: number; kinds: PricingRuleKind[] }[];
  platform_fee: number;
  commission_rate: number;
  round_to: number;
  /** Paid by the platform to the provider for every delivered ride (0 = no bonus). */
  driver_bonus_kz: number;
  /** Discount on the first ride of a client who redeemed an invite code (0 = invites off). */
  referral_invitee_discount_kz: number;
  /** Discount the inviter earns once the invited client's first ride is paid. */
  referral_inviter_discount_kz: number;
  updated_at: string;
  updated_by: string;
};

export const DEFAULT_PRICING: PricingConfig = {
  rules: [
    { kind: "tow", base: 8000, per_km: 250 },
    { kind: "cargo", base: 5500, per_km: 250 },
    { kind: "small_move", base: 9000, per_km: 300 },
    { kind: "house_move", base: 18000, per_km: 400 },
  ],
  extras: [],
  platform_fee: 500,
  commission_rate: 0.15,
  round_to: 500,
  driver_bonus_kz: 0,
  referral_invitee_discount_kz: 0,
  referral_inviter_discount_kz: 0,
  updated_at: new Date(0).toISOString(),
  updated_by: "Sistema",
};

let testOverride: Partial<PricingConfig> | null = null;

/** Tests set fees/bonus/invite values for their own process only, without writing to the shared settings row. */
export function setPricingOverrideForTests(override: Partial<PricingConfig> | null) {
  testOverride = override;
}

export async function loadPricingConfig(): Promise<PricingConfig> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, PRICING_SETTINGS_KEY)).limit(1);
  // Rows saved before the bonus/invite fields existed fall back to their defaults (0).
  return { ...DEFAULT_PRICING, ...((row?.value as Partial<PricingConfig> | undefined) ?? {}), ...(testOverride ?? {}) };
}
