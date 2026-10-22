import { estimatePrice } from "@/lib/leva-ja/pricing";
import { distanceKm, isEligible, zoneFor } from "@/lib/leva-ja/eligibility";
import { ACTIVE_STATUSES, nextStatus } from "@/lib/leva-ja/status";
import type { Coordinates, ServiceKind } from "@/types/leva-ja";
import type { MockDatabase } from "./database";
import { MINUTE, syncRequestTransactions } from "./domain";
import { REVIEW_COMMENTS, ZONE_STREETS } from "./fixtures";
import { STALLED_SEARCHING_MINUTES } from "./metrics";
import type { StoredRequest } from "./state";

function jitter(coords: Coordinates, random: () => number, size = 0.0025): Coordinates {
  return {
    latitude: Math.round((coords.latitude + (random() - 0.5) * size) * 1e5) / 1e5,
    longitude: Math.round((coords.longitude + (random() - 0.5) * size) * 1e5) / 1e5,
  };
}

function towards(from: Coordinates, to: Coordinates, step: number): Coordinates {
  return {
    latitude: Math.round((from.latitude + (to.latitude - from.latitude) * step) * 1e5) / 1e5,
    longitude: Math.round((from.longitude + (to.longitude - from.longitude) * step) * 1e5) / 1e5,
  };
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function createSearchingRequest(db: MockDatabase) {
  const { state, random } = db;
  const clients = state.clients.filter((client) => !client.blocked);
  if (!clients.length || !state.zones.length) return null;
  const client = pick(clients, random);
  const kind = pick<ServiceKind>(["tow", "cargo", "cargo", "small_move", "tow", "house_move"], random);
  const zone = pick(state.zones, random);
  const target = pick(state.zones, random);
  const place = (zoneId: string, center: Coordinates) => {
    const streets = ZONE_STREETS[zoneId] ?? ["Rua principal"];
    const zoneName = state.zones.find((item) => item.id === zoneId)?.name ?? "Luanda";
    return {
      id: db.nextId("pl"),
      label: `${pick(streets, random)}, ${Math.floor(random() * 200) + 1}`,
      area: zoneName,
      city: "Luanda",
      coords: jitter(center, random, 0.03),
    };
  };
  const origin = place(zone.id, zone.coords);
  const destination = place(target.id, target.coords);
  const distance = Math.max(2, Math.round(distanceKm(origin.coords, destination.coords) * 1.35 * 10) / 10);
  const estimate = estimatePrice(state.pricing, { kind, distanceKm: distance });
  const now = db.now().toISOString();
  const lastCode = state.requests.reduce((max, request) => Math.max(max, Number(request.code.slice(3)) || 0), 10420);
  const request: StoredRequest = {
    id: db.nextId("req"),
    code: `LJ-${lastCode + 1}`,
    kind,
    status: "searching",
    clientId: client.id,
    origin,
    destination,
    stops: [],
    distanceKm: distance,
    durationMin: Math.round(distance * 2.6 + 8),
    createdAt: now,
    price: estimate.breakdown,
    providerEarning: estimate.providerEarning,
    paymentMethod: pick(["bank_reference", "card", "cash"] as const, random),
    timeline: [{ status: "searching", at: now }],
    zoneId: zoneFor(state.zones, origin.coords)?.id ?? zone.id,
    details:
      kind === "tow"
        ? { kind, incident: "breakdown", vehicle: { brand: "Toyota", model: "Corolla", plate: "LD-45-12-AC" } }
        : kind === "cargo"
          ? { kind, cargoType: "goods", weightKg: 200, volumeM3: 1.2 }
          : { kind, rooms: 2, floors: 1, hasElevator: false, helpers: 1 },
  };
  state.requests.push(request);
  return request;
}

function advance(db: MockDatabase, request: StoredRequest) {
  const { state } = db;
  const today = db.today();
  const now = db.now();
  if (request.dispute && !request.dispute.resolvedAt) return false;
  if (request.status === "searching") {
    if (now.getTime() - Date.parse(request.createdAt) > STALLED_SEARCHING_MINUTES * MINUTE) return false;
    const busy = new Set(
      state.requests.filter((item) => item.providerId && ACTIVE_STATUSES.includes(item.status)).map((item) => item.providerId),
    );
    const candidate = state.providers
      .filter((provider) => !busy.has(provider.id) && isEligible(provider, request, today))
      .sort((a, b) => distanceKm(a.coords, request.origin.coords) - distanceKm(b.coords, request.origin.coords))[0];
    if (!candidate) return false;
    request.providerId = candidate.id;
  }
  const next = nextStatus(request.status);
  if (!next) return false;
  request.status = next;
  request.timeline.push({ status: next, at: now.toISOString() });
  if (next === "delivered") {
    const client = state.clients.find((item) => item.id === request.clientId);
    request.proof = { receivedBy: client?.name ?? "Cliente", at: now.toISOString(), photoLabel: `Fotografia da entrega em ${request.destination.area}` };
  }
  if (next === "rated") {
    const rating = db.random() < 0.8 ? 5 : 4;
    request.rating = rating;
    request.review = pick(REVIEW_COMMENTS[rating], db.random);
  }
  syncRequestTransactions(state, request);
  return true;
}

export function tick(db: MockDatabase) {
  const { state, random } = db;
  let requestsChanged = false;
  for (const provider of state.providers) {
    if (provider.availability !== "online" || provider.accountStatus !== "active") continue;
    const active = state.requests.find((request) => request.providerId === provider.id && ACTIVE_STATUSES.includes(request.status));
    if (!active) provider.coords = jitter(provider.coords, random);
    else if (active.status === "assigned" || active.status === "en_route") provider.coords = towards(provider.coords, active.origin.coords, 0.2);
    else if (active.status === "in_transit") provider.coords = towards(provider.coords, active.destination.coords, 0.15);
  }
  if (random() < 0.12) requestsChanged = Boolean(createSearchingRequest(db)) || requestsChanged;
  if (random() < 0.3) {
    const candidates = state.requests.filter(
      (request) => ACTIVE_STATUSES.includes(request.status) || request.status === "delivered" || request.status === "paid",
    );
    if (candidates.length) requestsChanged = advance(db, pick(candidates, random)) || requestsChanged;
  }
  db.persist();
  db.emit("providers");
  if (requestsChanged) {
    db.emit("requests");
    db.emit("finance");
  }
}
