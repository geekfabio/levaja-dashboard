import type { PriceBreakdown, PricingConfig, PricingExtra, PricingRule, ServiceKind } from "@/types/leva-ja";

export const DEFAULT_PRICING_RULES: PricingRule[] = [
  { kind: "tow", base: 8000, perKm: 250 },
  { kind: "cargo", base: 5500, perKm: 250 },
  { kind: "small_move", base: 9000, perKm: 300 },
  { kind: "house_move", base: 18000, perKm: 400 },
];

export const DEFAULT_PRICING_EXTRAS: PricingExtra[] = [
  { id: "extra-helper", label: "Ajudante adicional", amount: 3000, kinds: ["small_move", "house_move", "cargo"] },
  { id: "extra-floor", label: "Piso sem elevador", amount: 1500, kinds: ["small_move", "house_move"] },
  { id: "extra-night", label: "Serviço nocturno (22h–6h)", amount: 2500, kinds: ["tow", "cargo", "small_move", "house_move"] },
  { id: "extra-stop", label: "Paragem intermédia", amount: 1000, kinds: ["cargo", "small_move", "house_move"] },
  { id: "extra-winch", label: "Guincho / resgate fora de estrada", amount: 4000, kinds: ["tow"] },
];

export const DEFAULT_PLATFORM_FEE = 500;
export const DEFAULT_COMMISSION_RATE = 0.15;
export const DEFAULT_ROUND_TO = 500;

export function defaultPricingConfig(updatedAt: string, updatedBy = "Sistema"): PricingConfig {
  return {
    rules: DEFAULT_PRICING_RULES.map((rule) => ({ ...rule })),
    extras: DEFAULT_PRICING_EXTRAS.map((extra) => ({ ...extra, kinds: [...extra.kinds] })),
    platformFee: DEFAULT_PLATFORM_FEE,
    commissionRate: DEFAULT_COMMISSION_RATE,
    roundTo: DEFAULT_ROUND_TO,
    updatedAt,
    updatedBy,
  };
}

export function roundToMultiple(value: number, multiple: number) {
  if (multiple <= 0) return Math.round(value);
  return Math.round(value / multiple) * multiple;
}

export function ruleFor(config: PricingConfig, kind: ServiceKind) {
  const rule = config.rules.find((item) => item.kind === kind);
  if (!rule) throw new Error(`Sem regra de preço para ${kind}`);
  return rule;
}

export type PriceInput = { kind: ServiceKind; distanceKm: number; extrasAmount?: number };

export type PriceEstimate = {
  breakdown: PriceBreakdown;
  serviceValue: number;
  commission: number;
  providerEarning: number;
  platformRevenue: number;
};

export function splitServiceValue(config: PricingConfig, serviceValue: number) {
  const commission = Math.round(serviceValue * config.commissionRate);
  return {
    commission,
    providerEarning: serviceValue - commission,
    platformRevenue: commission + config.platformFee,
  };
}

export function estimatePrice(config: PricingConfig, input: PriceInput): PriceEstimate {
  const rule = ruleFor(config, input.kind);
  const extras = Math.max(0, input.extrasAmount ?? 0);
  const raw = rule.base + input.distanceKm * rule.perKm + extras;
  const serviceValue = roundToMultiple(raw, config.roundTo);
  const breakdown: PriceBreakdown = {
    base: rule.base,
    distance: serviceValue - rule.base - extras,
    extras,
    platformFee: config.platformFee,
    total: serviceValue + config.platformFee,
  };
  return { breakdown, serviceValue, ...splitServiceValue(config, serviceValue) };
}

export function serviceValueOf(price: PriceBreakdown) {
  return price.total - price.platformFee;
}

export function priceWithProposal(config: PricingConfig, estimate: PriceEstimate, amount: number): PriceEstimate {
  const serviceValue = roundToMultiple(amount, config.roundTo);
  const breakdown: PriceBreakdown = {
    ...estimate.breakdown,
    extras: serviceValue - estimate.breakdown.base - estimate.breakdown.distance,
    total: serviceValue + config.platformFee,
  };
  return { breakdown, serviceValue, ...splitServiceValue(config, serviceValue) };
}

export type PricingValidationIssue = { field: string; message: string };

export function validatePricingConfig(config: Pick<PricingConfig, "rules" | "extras" | "platformFee" | "commissionRate" | "roundTo">) {
  const issues: PricingValidationIssue[] = [];
  const kinds = new Set(config.rules.map((rule) => rule.kind));
  if (kinds.size !== 4) issues.push({ field: "rules", message: "Cada serviço tem de ter exactamente uma regra de preço." });
  for (const rule of config.rules) {
    if (!Number.isFinite(rule.base) || rule.base <= 0) {
      issues.push({ field: `rules.${rule.kind}.base`, message: "O preço base tem de ser superior a 0 Kz." });
    }
    if (!Number.isFinite(rule.perKm) || rule.perKm <= 0) {
      issues.push({ field: `rules.${rule.kind}.perKm`, message: "O preço por km tem de ser superior a 0 Kz." });
    }
  }
  for (const extra of config.extras) {
    if (!extra.label.trim()) issues.push({ field: `extras.${extra.id}.label`, message: "Cada extra precisa de um nome." });
    if (!Number.isFinite(extra.amount) || extra.amount < 0) {
      issues.push({ field: `extras.${extra.id}.amount`, message: "O valor do extra não pode ser negativo." });
    }
    if (extra.kinds.length === 0) {
      issues.push({ field: `extras.${extra.id}.kinds`, message: "Escolha pelo menos um serviço para o extra." });
    }
  }
  if (!Number.isFinite(config.platformFee) || config.platformFee < 0) {
    issues.push({ field: "platformFee", message: "A taxa da plataforma não pode ser negativa." });
  }
  if (!Number.isFinite(config.commissionRate) || config.commissionRate < 0 || config.commissionRate > 0.5) {
    issues.push({ field: "commissionRate", message: "A comissão tem de estar entre 0 % e 50 %." });
  }
  if (!Number.isFinite(config.roundTo) || config.roundTo < 0) {
    issues.push({ field: "roundTo", message: "O arredondamento não pode ser negativo." });
  }
  return issues;
}
