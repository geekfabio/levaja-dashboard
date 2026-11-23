import type {
  Client,
  ClientAccount,
  Coordinates,
  Dispute,
  Place,
  Provider,
  ProviderAccount,
  ProviderDocument,
  Refund,
  ServiceDetails,
  ServiceRequest,
  SosAlert,
  Vehicle,
} from "@/types/leva-ja";
import type { DisputeCase } from "../repositories/disputes";
import type { DocumentReviewItem } from "../repositories/documents";
import type { ProviderPosition } from "../repositories/providers";
import type { Page } from "../repositories/common";
import type { SessionView } from "../repositories/security";
import type { ZoneWithStats } from "../repositories/zones";

export type Dto = Record<string, any>;

const EMPTY_VEHICLE: Vehicle = { id: "", brand: "—", model: "", plate: "—", color: "", vehicleClass: "pickup", categoryLabel: "", capacityKg: 0, year: 0 };

const TOW_INCIDENTS: Record<string, "breakdown" | "accident" | "flat_tire" | "battery" | "other"> = {
  mechanical: "breakdown",
  accident: "accident",
  flat_tire: "flat_tire",
  battery: "battery",
  no_fuel: "other",
};
const CARGO_TYPES = ["goods", "construction", "furniture", "appliances", "other"] as const;
const WEIGHT_KG: Record<string, number> = { upto100: 100, "101to300": 300, "301to500": 500, over500: 800 };
const VOLUME_M3: Record<string, number> = { small: 1, medium: 3, large: 6 };

const orUndefined = <T>(value: T | null | undefined) => (value === null ? undefined : value);

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const toCoords = (value: Dto): Coordinates => ({ latitude: Number(value?.lat ?? value?.latitude ?? 0), longitude: Number(value?.lng ?? value?.longitude ?? 0) });

export const toPlace = (dto: Dto): Place => ({ id: dto.id ?? "", label: dto.label ?? "", area: dto.district ?? dto.area ?? "", city: dto.city ?? "", coords: toCoords(dto) });

export const toVehicle = (dto: Dto | null | undefined): Vehicle =>
  dto
    ? {
        id: dto.id,
        brand: dto.brand,
        model: dto.model,
        plate: dto.plate,
        color: dto.color,
        vehicleClass: dto.class ?? dto.vehicleClass,
        categoryLabel: dto.categoryLabel ?? "",
        capacityKg: dto.capacityKg ?? 0,
        year: dto.year ?? 0,
      }
    : EMPTY_VEHICLE;

export const toClient = (dto: Dto): Client => ({
  id: dto.id,
  name: dto.fullName,
  email: dto.email ?? "",
  phone: dto.phone ?? "",
  initials: initialsOf(dto.fullName ?? ""),
  rating: dto.rating ?? 0,
  avatar: orUndefined(dto.avatarUrl),
});

export const toProvider = (dto: Dto): Provider => ({
  id: dto.id,
  name: dto.fullName,
  initials: initialsOf(dto.fullName ?? ""),
  phone: dto.phone ?? "",
  rating: dto.rating ?? 0,
  reviewsCount: dto.reviewsCount ?? 0,
  verified: Boolean(dto.verified),
  avatar: orUndefined(dto.avatarUrl),
  vehicle: toVehicle(dto.vehicle),
  coords: toCoords(dto.location ?? dto.coords ?? {}),
});

export const toDocument = (dto: Dto): ProviderDocument => {
  const expired = dto.status === "verified" && dto.validUntil && Date.parse(dto.validUntil) < Date.now();
  return {
    id: dto.id,
    title: dto.title,
    icon: dto.kind,
    validUntil: dto.validUntil ? String(dto.validUntil).slice(0, 10) : "",
    state: expired ? "expired" : dto.status === "rejected" ? "needs_update" : dto.status,
  };
};

export const toReviewItem = (dto: Dto): DocumentReviewItem => ({
  document: toDocument(dto),
  providerId: dto.providerId,
  providerName: dto.providerName,
  providerInitials: initialsOf(dto.providerName ?? ""),
  vehiclePlate: dto.vehiclePlate ?? "",
  submittedAt: dto.submittedAt,
});

export const toProviderAccount = (dto: Dto): ProviderAccount => ({
  ...toProvider({ ...dto, location: dto.coords }),
  email: dto.email ?? "",
  availability: dto.availability,
  accountStatus: dto.accountStatus,
  suspensionReason: orUndefined(dto.suspensionReason),
  zoneIds: dto.zoneIds ?? [],
  services: dto.services ?? [],
  documents: (dto.documents ?? []).map(toDocument),
  balance: dto.balance ?? 0,
  totalEarnings: dto.totalEarnings ?? 0,
  completedCount: dto.completedCount ?? 0,
  joinedAt: dto.joinedAt,
  fleetId: orUndefined(dto.fleetId),
  suspendedUntil: orUndefined(dto.suspendedUntil),
});

export const toProviderPosition = (dto: Dto): ProviderPosition => ({
  id: dto.id,
  name: dto.fullName,
  initials: initialsOf(dto.fullName ?? ""),
  coords: toCoords(dto.coords ?? {}),
  services: dto.services ?? [],
  availability: dto.availability,
  rating: dto.rating ?? 0,
  activeRequestId: orUndefined(dto.activeRequestId),
  vehicleLabel: dto.vehicleLabel ?? "—",
  vehicleClass: dto.vehicleClass ?? "pickup",
});

export const toClientAccount = (dto: Dto): ClientAccount => ({
  ...toClient(dto),
  blocked: Boolean(dto.blocked),
  blockedReason: orUndefined(dto.blockedReason),
  createdAt: dto.createdAt,
  addresses: (dto.addresses ?? []).map(toPlace),
  paymentMethods: dto.paymentMethods ?? [],
  requestsCount: dto.requestsCount ?? 0,
  totalSpent: dto.totalSpent ?? 0,
});

export const toZone = (dto: Dto): ZoneWithStats => ({ ...(dto as ZoneWithStats), coords: toCoords(dto.coords ?? {}), radiusKm: Number(dto.radiusKm) });

export const toSos = (dto: Dto): SosAlert => ({ ...(dto as SosAlert), coords: toCoords(dto.coords ?? {}) });

export const toSession = (dto: Dto): SessionView => ({
  current: Boolean(dto.current),
  id: dto.id,
  userId: dto.userId,
  userName: dto.userName,
  role: dto.role,
  device: dto.device ?? dto.userAgent ?? "—",
  ip: dto.ip ?? "",
  location: dto.location ?? "—",
  createdAt: dto.createdAt,
  lastSeenAt: dto.lastSeenAt ?? dto.createdAt,
  revokedAt: orUndefined(dto.revokedAt),
  revokedBy: orUndefined(dto.revokedBy),
});

export const toRefund = (dto: Dto): Refund => ({
  ...(dto as Refund),
  method: dto.method ?? dto.paymentMethod,
  requestedById: dto.requestedById ?? dto.requestedByAccountId,
  providerId: orUndefined(dto.providerId),
  providerName: orUndefined(dto.providerName),
  decidedAt: orUndefined(dto.decidedAt),
  decidedBy: orUndefined(dto.decidedBy),
  decisionReason: orUndefined(dto.decisionReason),
  paidAt: orUndefined(dto.paidAt),
  paymentReference: orUndefined(dto.paymentReference),
});

export const toDispute = (dto: Dto): Dispute => ({
  reason: dto.reason,
  category: orUndefined(dto.category),
  openedAt: dto.openedAt,
  openedBy: dto.openedBy ?? "—",
  notes: dto.notes ?? [],
  resolvedAt: orUndefined(dto.resolvedAt),
  resolvedBy: orUndefined(dto.resolvedBy),
  resolution: orUndefined(dto.resolution),
  outcome: orUndefined(dto.outcome),
  refundId: orUndefined(dto.refundId),
});

function toDetails(dto: Dto): ServiceDetails {
  const kind = dto.serviceType as ServiceRequest["kind"];
  if (kind === "tow") {
    const tow = dto.towDetails ?? {};
    return { kind: "tow", incident: TOW_INCIDENTS[tow.incident] ?? "other", vehicle: { brand: tow.brand ?? "—", model: tow.model ?? "", plate: tow.plate ?? "—" } };
  }
  if (kind === "cargo") {
    const cargo = dto.cargoDetails ?? {};
    return {
      kind: "cargo",
      cargoType: (CARGO_TYPES as readonly string[]).includes(cargo.cargoType) ? cargo.cargoType : "other",
      weightKg: WEIGHT_KG[cargo.weight] ?? 0,
      volumeM3: VOLUME_M3[cargo.volume] ?? 0,
    };
  }
  const moving = dto.movingDetails ?? {};
  return { kind, rooms: moving.rooms ?? 1, floors: Math.max(moving.pickupFloor ?? 0, moving.deliveryFloor ?? 0), hasElevator: Boolean(moving.elevator), helpers: moving.helpers ?? 0 };
}

function toPhotos(dto: Dto): ServiceRequest["photos"] {
  const at = dto.createdAt;
  const own = (list: Dto[] | undefined, stage: "pickup" | "delivery", by: "client" | "provider") =>
    (list ?? []).map((photo) => ({ id: photo.id, stage, label: photo.caption ?? "", at, by }));
  return [...own(dto.photos, "pickup", "client"), ...own(dto.pickupPhotos, "pickup", "provider"), ...own(dto.proof?.photos, "delivery", "provider")];
}

export function toServiceRequest(dto: Dto): ServiceRequest {
  const proof = dto.proof
    ? { receivedBy: dto.proof.signedBy ?? "", at: dto.proof.deliveredAt ?? dto.createdAt, photoLabel: dto.proof.photos?.[0]?.caption ?? "" }
    : undefined;
  const photos = toPhotos(dto);
  return {
    id: dto.id,
    code: dto.code,
    kind: dto.serviceType,
    status: dto.status,
    clientId: dto.clientId,
    providerId: orUndefined(dto.providerId),
    client: dto.client ? toClient(dto.client) : undefined,
    provider: dto.provider ? toProvider(dto.provider) : undefined,
    origin: toPlace(dto.pickup ?? {}),
    destination: toPlace(dto.dropoff ?? {}),
    stops: (dto.stops ?? []).map(toPlace),
    distanceKm: dto.distanceKm ?? 0,
    durationMin: dto.durationMin ?? 0,
    createdAt: dto.createdAt,
    scheduledFor: orUndefined(dto.scheduledFor),
    price: dto.pricing,
    providerEarning: dto.providerEarning ?? 0,
    proposal: orUndefined(dto.proposal),
    paymentMethod: orUndefined(dto.paymentMethod),
    rating: orUndefined(dto.rating),
    review: orUndefined(dto.review),
    timeline: dto.timeline ?? [],
    cancelReason: orUndefined(dto.cancelReason),
    zoneId: dto.zoneId ?? "",
    details: toDetails(dto),
    proof,
    dispute: dto.dispute ? toDispute(dto.dispute) : undefined,
    photos: photos && photos.length ? photos : undefined,
  };
}

export const toDisputeCase = (dto: Dto): DisputeCase => ({
  request: toServiceRequest({ ...dto.request, dispute: dto.dispute ?? dto.request?.dispute }),
  refundable: dto.refundable ?? 0,
  refunded: dto.refunded ?? 0,
  overdue: Boolean(dto.overdue),
});

export const toDisputedRequest = (dto: Dto): ServiceRequest => toDisputeCase(dto).request;

export const mapPage = <T, U>(page: Page<T>, map: (item: T) => U): Page<U> => ({ ...page, items: page.items.map(map) });
