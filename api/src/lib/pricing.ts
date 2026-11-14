import { loadPricingConfig, type PricingConfig, type PricingRuleKind } from "./pricing-config";

export type ServiceKind = PricingRuleKind;

export type TowDetailsInput = { can_move?: boolean; incident?: string };
export type CargoDetailsInput = {
  weight_range?: "upto100" | "101to300" | "301to500" | "over500";
  volume?: "small" | "medium" | "large";
  vehicle_class?: "tuk_tuk" | "pickup" | "tow_truck" | "van" | "truck";
  helper?: boolean;
};
export type MovingDetailsInput = {
  rooms?: number;
  helpers?: number;
  pickup_floor?: number;
  delivery_floor?: number;
  elevator?: boolean;
  disassembly?: boolean;
};

export type PricingInput = {
  serviceType: ServiceKind;
  distanceKm: number;
  tow?: TowDetailsInput | null;
  cargo?: CargoDetailsInput | null;
  moving?: MovingDetailsInput | null;
};

export type PriceBreakdown = {
  base_kz: number;
  distance_kz: number;
  extras_kz: number;
  platform_fee_kz: number;
  /** Full price of the service; what the client actually pays is total_kz - discount_kz. */
  total_kz: number;
  /** Promotion/invite discount, paid for by the platform (credited to the provider's cash balance). */
  discount_kz?: number;
  discount_label?: string;
};

const WEIGHT_EXTRA: Record<NonNullable<CargoDetailsInput["weight_range"]>, number> = {
  upto100: 0,
  "101to300": 1500,
  "301to500": 3000,
  over500: 6000,
};

const VOLUME_EXTRA: Record<NonNullable<CargoDetailsInput["volume"]>, number> = {
  small: 0,
  medium: 1000,
  large: 2500,
};

const VEHICLE_CLASS_EXTRA: Record<NonNullable<CargoDetailsInput["vehicle_class"]>, number> = {
  tuk_tuk: -1000,
  pickup: 0,
  tow_truck: 0,
  van: 2000,
  truck: 6000,
};

function detailExtrasFor(input: PricingInput) {
  let extras = 0;
  if (input.serviceType === "tow" && input.tow) {
    if (input.tow.can_move === false) extras += 1500;
    if (input.tow.incident === "accident") extras += 2000;
  }
  if (input.serviceType === "cargo" && input.cargo) {
    extras += WEIGHT_EXTRA[input.cargo.weight_range ?? "upto100"];
    extras += VOLUME_EXTRA[input.cargo.volume ?? "small"];
    extras += VEHICLE_CLASS_EXTRA[input.cargo.vehicle_class ?? "pickup"];
    if (input.cargo.helper) extras += 2000;
  }
  if ((input.serviceType === "small_move" || input.serviceType === "house_move") && input.moving) {
    if (input.serviceType === "house_move") extras += Math.max(0, (input.moving.rooms ?? 1) - 1) * 2000;
    extras += (input.moving.helpers ?? 0) * 2500;
    if (!input.moving.elevator) extras += ((input.moving.pickup_floor ?? 0) + (input.moving.delivery_floor ?? 0)) * 500;
    if (input.moving.disassembly) extras += 5000;
  }
  return extras;
}

function configuredExtrasFor(input: PricingInput, config: PricingConfig) {
  return config.extras.filter((extra) => extra.kinds.includes(input.serviceType)).reduce((total, extra) => total + extra.amount, 0);
}

function ruleFor(config: PricingConfig, serviceType: ServiceKind) {
  return config.rules.find((rule) => rule.kind === serviceType);
}

export async function estimatePrice(input: PricingInput): Promise<PriceBreakdown> {
  const config = await loadPricingConfig();
  const rule = ruleFor(config, input.serviceType);
  const roundTo = (value: number) => Math.round(value / config.round_to) * config.round_to;

  const base = rule?.base ?? 0;
  const distance = roundTo(input.distanceKm * (rule?.per_km ?? 0));
  const extras = detailExtrasFor(input) + configuredExtrasFor(input, config);
  const service = roundTo(base + distance + extras);
  return {
    base_kz: base,
    distance_kz: distance,
    extras_kz: service - base - distance,
    platform_fee_kz: config.platform_fee,
    total_kz: service + config.platform_fee,
  };
}

export async function providerEarningFor(price: Pick<PriceBreakdown, "total_kz" | "platform_fee_kz">): Promise<number> {
  const config = await loadPricingConfig();
  const service = price.total_kz - price.platform_fee_kz;
  return Math.floor((service * (1 - config.commission_rate)) / config.round_to) * config.round_to;
}

export const needsProposal = (serviceType: ServiceKind) => serviceType === "house_move";
