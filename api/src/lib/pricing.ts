export type ServiceKind = "tow" | "cargo" | "small_move" | "house_move";

export const PLATFORM_FEE_KZ = 500;
export const PROVIDER_COMMISSION = 0.15;

const BASE_KZ: Record<ServiceKind, number> = {
  tow: 8000,
  cargo: 5500,
  small_move: 9000,
  house_move: 18000,
};

const PER_KM_KZ: Record<ServiceKind, number> = {
  tow: 250,
  cargo: 250,
  small_move: 300,
  house_move: 400,
};

const roundTo500 = (value: number) => Math.round(value / 500) * 500;

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
  total_kz: number;
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

function extrasFor(input: PricingInput) {
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

export function estimatePrice(input: PricingInput): PriceBreakdown {
  const base = BASE_KZ[input.serviceType];
  const distance = roundTo500(input.distanceKm * PER_KM_KZ[input.serviceType]);
  const extras = extrasFor(input);
  const service = roundTo500(base + distance + extras);
  return {
    base_kz: base,
    distance_kz: distance,
    extras_kz: service - base - distance,
    platform_fee_kz: PLATFORM_FEE_KZ,
    total_kz: service + PLATFORM_FEE_KZ,
  };
}

export function providerEarningFor(price: Pick<PriceBreakdown, "total_kz" | "platform_fee_kz">) {
  const service = price.total_kz - price.platform_fee_kz;
  return Math.floor((service * (1 - PROVIDER_COMMISSION)) / 500) * 500;
}

export const needsProposal = (serviceType: ServiceKind) => serviceType === "house_move";
