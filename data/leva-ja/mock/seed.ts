import { formatKz, luandaDay } from "@/lib/format";
import { ACTIVE_STATUSES, CANCELLABLE_STATUSES, STATUS_FLOW } from "@/lib/leva-ja/status";
import { defaultPricingConfig, estimatePrice, priceWithProposal } from "@/lib/leva-ja/pricing";
import { normalizeRolePermissions } from "@/lib/leva-ja/permissions";
import { defaultPlatformSettings } from "@/lib/leva-ja/settings";
import { distanceKm, isDocumentValid, zoneFor } from "@/lib/leva-ja/eligibility";
import { DOCUMENT_ICONS, DOCUMENT_TITLES, VEHICLE_CLASS_LABELS, VEHICLE_SERVICES } from "@/lib/leva-ja/services";
import type {
  AdminUser,
  AuditLogEntry,
  CargoType,
  ClientAccount,
  ClientPaymentMethod,
  Coordinates,
  DocumentState,
  PaymentMethodKind,
  Place,
  PricingConfig,
  ProviderAccount,
  ProviderDocument,
  ApplicationStage,
  Broadcast,
  BusinessAccount,
  Promotion,
  Claim,
  CashDeposit,
  Fleet,
  Penalty,
  ProviderApplication,
  PayoutBatch,
  Refund,
  SettlementMethod,
  ServiceDetails,
  ServiceKind,
  ServiceStatus,
  SosAlert,
  Ticket,
  TicketMessage,
  TowIncident,
  VehicleClass,
  Withdrawal,
  Zone,
} from "@/types/leva-ja";
import { cashCharges, expectedSettlements, settlementId } from "./billing";
import { syncPenaltyTransaction } from "./quality";
import { createRandom } from "./random";
import type { Random } from "./random";
import {
  ADMIN_REPLIES,
  CANCEL_REASONS,
  CLIENT_CARS,
  CLIENT_FIRST_NAMES,
  CLIENT_TICKET_SUBJECTS,
  LAST_NAMES,
  PROVIDER_FIRST_NAMES,
  PROVIDER_TICKET_SUBJECTS,
  REVIEW_COMMENTS,
  TICKET_RESOLUTIONS,
  VEHICLE_CAPACITY,
  VEHICLE_COLORS,
  VEHICLE_MODELS,
  ZONES,
  ZONE_STREETS,
  initialsOf,
  slugify,
} from "./fixtures";
import { DAY, HOUR, MINUTE, addDays, eventAt, isoAt, luandaMidnight, providerBalance, syncRefundTransaction, syncRequestTransactions } from "./domain";
import { MOCK_STATE_VERSION } from "./state";
import type { MockState, StoredSettlement, StoredRequest } from "./state";

export const DEFAULT_SEED = 20_250_611;

export const DEMO_ADMIN_CODE = "123456";

export const SEED_ELIGIBLE_AFTER_APPROVAL = "prv-04";

type Context = {
  rng: Random;
  now: number;
  today: string;
  placeSeq: number;
  pricing: PricingConfig;
};

function pad(value: number, size = 3) {
  return String(value).padStart(size, "0");
}

function phone(rng: Random) {
  const prefix = rng.pick(["92", "93", "94", "95", "99", "91", "97"]);
  const digits = `${prefix}${rng.int(0, 9)}${pad(rng.int(0, 999))}${pad(rng.int(0, 999))}`;
  return `+244 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function plate(rng: Random) {
  const letters = "ABCDEFGHJKLMNPRSTUVXZ";
  return `LD-${pad(rng.int(10, 99), 2)}-${pad(rng.int(10, 99), 2)}-${letters[rng.int(0, letters.length - 1)]}${letters[rng.int(0, letters.length - 1)]}`;
}

function iban(rng: Random) {
  const group = () => pad(rng.int(0, 9999), 4);
  return `AO06 ${group()} ${group()} ${group()} ${group()} ${group()} ${rng.int(0, 9)}`;
}

function offset(coords: Coordinates, km: number, angle: number): Coordinates {
  const latitude = coords.latitude + (km / 111) * Math.sin(angle);
  const longitude = coords.longitude + (km / (111 * Math.cos((coords.latitude * Math.PI) / 180))) * Math.cos(angle);
  return { latitude: Math.round(latitude * 1e5) / 1e5, longitude: Math.round(longitude * 1e5) / 1e5 };
}

function pointIn(ctx: Context, zone: Zone) {
  return offset(zone.coords, ctx.rng.float(0, zone.radiusKm * 0.7), ctx.rng.float(0, Math.PI * 2));
}

function placeIn(ctx: Context, zone: Zone): Place {
  ctx.placeSeq += 1;
  const street = ctx.rng.pick(ZONE_STREETS[zone.id]);
  const label = street.includes(",") || street.startsWith("Mercado") || street.startsWith("Belas") ? street : `${street}, ${ctx.rng.int(1, 240)}`;
  return { id: `pl-${pad(ctx.placeSeq, 4)}`, label, area: zone.name, city: "Luanda", coords: pointIn(ctx, zone) };
}

function personName(rng: Random, first: string) {
  const last = rng.pick(LAST_NAMES);
  return `${first} ${last}`;
}

function buildAdminUsers(now: number): AdminUser[] {
  const users: [string, string, string, AdminUser["role"], boolean][] = [
    ["adm-1", "Armando Silva", "admin@levaja.ao", "admin", true],
    ["adm-2", "Ana Neto", "operacoes@levaja.ao", "operations", true],
    ["adm-3", "João Manuel", "suporte@levaja.ao", "support", true],
    ["adm-4", "Esperança Domingos", "financas@levaja.ao", "finance", true],
    ["adm-5", "Nelson Cardoso", "nelson.cardoso@levaja.ao", "operations", true],
    ["adm-6", "Teresa Lopes", "teresa.lopes@levaja.ao", "support", false],
  ];
  return users.map(([id, name, email, role, active], index) => ({
    id,
    name,
    email,
    initials: initialsOf(name),
    role,
    active,
    createdAt: isoAt(now - (180 - index * 20) * DAY),
    lastLoginAt: active ? isoAt(now - (index + 1) * 3 * HOUR) : undefined,
  }));
}

function buildClients(ctx: Context): ClientAccount[] {
  const { rng } = ctx;
  return CLIENT_FIRST_NAMES.map((first, index) => {
    const name = personName(rng, first);
    const homeZone = rng.pick(ZONES);
    const addresses = [placeIn(ctx, homeZone)];
    if (rng.chance(0.6)) addresses.push(placeIn(ctx, rng.pick(ZONES)));
    const methods: ClientPaymentMethod[] = [];
    const kinds = rng.sample<PaymentMethodKind>(["bank_reference", "card", "cash"], rng.int(1, 3));
    kinds.forEach((kind, position) => {
      methods.push({
        id: `pm-${pad(index + 1)}-${position + 1}`,
        kind,
        label:
          kind === "card"
            ? `${rng.pick(["Visa", "Mastercard"])} •••• ${pad(rng.int(0, 9999), 4)}`
            : kind === "bank_reference"
              ? "Referência Multicaixa"
              : "Numerário",
        isDefault: position === 0,
      });
    });
    const blocked = index === 7 || index === 23;
    return {
      id: `cli-${pad(index + 1)}`,
      name,
      email: `${slugify(name)}@gmail.com`,
      phone: phone(rng),
      initials: initialsOf(name),
      rating: Math.round(rng.float(4.1, 5) * 10) / 10,
      blocked,
      blockedReason: blocked
        ? index === 7
          ? "Três cancelamentos após a chegada do prestador nesta semana."
          : "Comportamento abusivo reportado por dois prestadores."
        : undefined,
      createdAt: isoAt(ctx.now - rng.int(65, 420) * DAY),
      addresses,
      paymentMethods: methods,
      requestsCount: 0,
      totalSpent: 0,
    };
  });
}

const PROVIDER_CLASSES: VehicleClass[] = ["tow_truck", "pickup", "van", "truck"];

function documentsFor(ctx: Context, index: number, accountStatus: ProviderAccount["accountStatus"]) {
  const { rng, today } = ctx;
  const submitted: Record<string, string> = {};
  const documents: ProviderDocument[] = DOCUMENT_ICONS.map((icon) => {
    const id = `doc-${pad(index + 1, 2)}-${icon}`;
    submitted[id] = isoAt(ctx.now - rng.int(40, 400) * DAY);
    return { id, title: DOCUMENT_TITLES[icon], icon, state: "verified", validUntil: addDays(today, rng.int(60, 700)) };
  });
  const set = (icon: ProviderDocument["icon"], state: DocumentState, validInDays: number, submittedHoursAgo?: number) => {
    const document = documents.find((item) => item.icon === icon);
    if (!document) return;
    document.state = state;
    document.validUntil = addDays(today, validInDays);
    if (submittedHoursAgo !== undefined) submitted[document.id] = isoAt(ctx.now - submittedHoursAgo * HOUR);
  };
  if (accountStatus === "pending_approval") {
    set("license", "pending", rng.int(200, 900), rng.int(3, 90));
    set("id", "pending", rng.int(400, 1500), rng.int(3, 90));
    set("insurance", "pending", rng.int(100, 360), rng.int(3, 90));
  }
  if (index === 3) set("insurance", "pending", 300, 5);
  if (index === 5) set("license", "needs_update", 20, 120);
  if (index === 8) set("vehicle", "expired", -12);
  if (index === 12) set("id", "pending", 800, 26);
  if (index === 20) set("insurance", "expired", -40);
  if ([1, 6, 10, 14].includes(index)) set(rng.pick(DOCUMENT_ICONS), "verified", rng.int(4, 28));
  return { documents, submitted };
}

function buildProviders(ctx: Context) {
  const { rng } = ctx;
  const submittedAt: Record<string, string> = {};
  const providers: ProviderAccount[] = PROVIDER_FIRST_NAMES.map((first, index) => {
    const name = personName(rng, first);
    const vehicleClass = PROVIDER_CLASSES[index % 4];
    const [brand, model] = rng.pick(VEHICLE_MODELS[vehicleClass]);
    const accountStatus: ProviderAccount["accountStatus"] =
      index >= 22 ? "pending_approval" : index >= 19 ? "suspended" : "active";
    const home = ZONES[index % ZONES.length];
    const others = rng.sample(
      ZONES.filter((zone) => zone.id !== home.id).sort((a, b) => distanceKm(home.coords, a.coords) - distanceKm(home.coords, b.coords)).slice(0, 5),
      rng.int(2, 4),
    );
    const { documents, submitted } = documentsFor(ctx, index, accountStatus);
    Object.assign(submittedAt, submitted);
    const joinedDaysAgo = accountStatus === "pending_approval" ? rng.int(1, 6) : rng.int(70, 520);
    return {
      id: `prv-${pad(index + 1, 2)}`,
      name,
      initials: initialsOf(name),
      phone: phone(rng),
      email: `${slugify(name)}@gmail.com`,
      rating: Math.round(rng.float(4, 4.9) * 10) / 10,
      reviewsCount: 0,
      verified: false,
      vehicle: {
        id: `veh-${pad(index + 1, 2)}`,
        brand,
        model,
        plate: plate(rng),
        color: rng.pick(VEHICLE_COLORS),
        vehicleClass,
        categoryLabel: VEHICLE_CLASS_LABELS[vehicleClass],
        capacityKg: VEHICLE_CAPACITY[vehicleClass],
        year: rng.int(2009, 2023),
      },
      coords: pointIn(ctx, home),
      availability: accountStatus === "active" && (index === 3 || rng.chance(0.55)) ? "online" : "offline",
      accountStatus,
      suspensionReason:
        accountStatus === "suspended"
          ? [
              "Duas queixas de cobrança indevida em numerário.",
              "Seguro da viatura expirado.",
              "Cancelamentos repetidos depois de aceitar pedidos.",
            ][index - 19]
          : undefined,
      zoneIds: [home.id, ...others.map((zone) => zone.id)],
      services: [...VEHICLE_SERVICES[vehicleClass]],
      documents,
      balance: 0,
      totalEarnings: 0,
      completedCount: 0,
      joinedAt: isoAt(ctx.now - joinedDaysAgo * DAY),
    };
  });
  return { providers, submittedAt };
}

function eligibleNow(provider: ProviderAccount, today: string) {
  return (
    provider.accountStatus === "active" &&
    provider.documents.length === 4 &&
    provider.documents.every((document) => isDocumentValid(document, today))
  );
}

const STEP_MINUTES: Record<ServiceStatus, [number, number]> = {
  searching: [0, 0],
  assigned: [1.5, 14],
  en_route: [1, 4],
  arrived: [6, 30],
  pickup_confirmed: [4, 20],
  in_transit: [1, 8],
  delivered: [0, 0],
  paid: [1, 15],
  rated: [3, 180],
  cancelled: [1, 15],
};

function stepMinutes(rng: Random, status: ServiceStatus, request: Pick<StoredRequest, "kind" | "durationMin">) {
  if (status === "delivered") return request.durationMin * rng.float(0.85, 1.3);
  if (status === "pickup_confirmed" && (request.kind === "house_move" || request.kind === "small_move")) {
    return rng.float(20, request.kind === "house_move" ? 120 : 50);
  }
  const [min, max] = STEP_MINUTES[status];
  return rng.float(min, max);
}

function detailsFor(rng: Random, kind: ServiceKind): ServiceDetails {
  if (kind === "tow") {
    const [brand, model] = rng.pick(CLIENT_CARS);
    return {
      kind,
      incident: rng.weighted<TowIncident>([["breakdown", 40], ["accident", 20], ["flat_tire", 15], ["battery", 15], ["other", 10]]),
      vehicle: { brand, model, plate: plate(rng) },
    };
  }
  if (kind === "cargo") {
    return {
      kind,
      cargoType: rng.weighted<CargoType>([["goods", 35], ["construction", 25], ["furniture", 15], ["appliances", 20], ["other", 5]]),
      weightKg: rng.int(4, 90) * 10,
      volumeM3: Math.round(rng.float(0.3, 4) * 10) / 10,
    };
  }
  const house = kind === "house_move";
  return {
    kind,
    rooms: house ? rng.int(2, 5) : rng.int(1, 2),
    floors: rng.int(0, house ? 6 : 3),
    hasElevator: rng.chance(0.35),
    helpers: house ? rng.int(1, 3) : rng.int(0, 1),
  };
}

function extrasFor(pricing: PricingConfig, details: ServiceDetails, hour: number, stops: number) {
  const amount = (id: string) => pricing.extras.find((extra) => extra.id === id)?.amount ?? 0;
  let total = 0;
  if (details.kind === "small_move" || details.kind === "house_move") {
    total += details.helpers * amount("extra-helper");
    if (!details.hasElevator) total += details.floors * amount("extra-floor");
  }
  if (details.kind === "tow" && details.incident === "accident") total += amount("extra-winch");
  if (hour >= 22 || hour < 6) total += amount("extra-night");
  total += stops * amount("extra-stop");
  return total;
}

type RequestPlan = {
  status: ServiceStatus;
  createdAt?: number;
  cancelFrom?: ServiceStatus;
  provider?: ProviderAccount;
  dayOffset: number;
};

function luandaHour(ms: number) {
  return new Date(ms + HOUR).getUTCHours();
}

function buildRequest(
  ctx: Context,
  index: number,
  plan: RequestPlan,
  clients: ClientAccount[],
  providers: ProviderAccount[],
): StoredRequest {
  const { rng } = ctx;
  const provider = plan.provider;
  const kind: ServiceKind = provider
    ? rng.pick(provider.services)
    : rng.weighted<ServiceKind>([["tow", 30], ["cargo", 30], ["small_move", 25], ["house_move", 15]]);
  const originZone = provider ? ZONES.find((zone) => zone.id === rng.pick(provider.zoneIds)) ?? ZONES[0] : rng.pick(ZONES);
  const destinationZone = kind === "tow" && rng.chance(0.5) ? originZone : rng.pick(ZONES);
  const origin = placeIn(ctx, originZone);
  const destination = placeIn(ctx, destinationZone);
  const stops = kind !== "tow" && rng.chance(0.12) ? [placeIn(ctx, rng.pick(ZONES))] : [];
  const straight = distanceKm(origin.coords, destination.coords);
  const distance = Math.max(2, Math.round(straight * 1.35 * 10) / 10);
  const durationMin = Math.round(distance * 2.6 + 8);
  const details = detailsFor(rng, kind);
  const activeClients = clients.filter((client) => !client.blocked);
  const client = plan.dayOffset > 10 ? rng.pick(clients) : rng.pick(activeClients);

  const base: Omit<StoredRequest, "price" | "providerEarning" | "timeline"> = {
    id: `req-${pad(index + 1)}`,
    code: "",
    kind,
    status: plan.status,
    clientId: client.id,
    origin,
    destination,
    stops,
    distanceKm: distance,
    durationMin,
    createdAt: "",
    zoneId: zoneFor(ZONES, origin.coords)?.id ?? originZone.id,
    details,
    paymentMethod: rng.weighted<PaymentMethodKind>([["bank_reference", 45], ["card", 25], ["cash", 30]]),
  };

  const flowTarget = plan.status === "cancelled" ? plan.cancelFrom ?? "searching" : plan.status;
  const targetIndex = STATUS_FLOW.indexOf(flowTarget);
  const steps: { status: ServiceStatus; minutes: number }[] = [{ status: "searching", minutes: 0 }];
  for (let step = 1; step <= targetIndex; step += 1) {
    const status = STATUS_FLOW[step];
    steps.push({ status, minutes: stepMinutes(rng, status, base) });
  }
  if (plan.status === "cancelled") steps.push({ status: "cancelled", minutes: stepMinutes(rng, "cancelled", base) });
  const totalMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  let created = plan.createdAt;
  if (created === undefined) {
    const midnight = luandaMidnight(new Date(ctx.now)) - plan.dayOffset * DAY;
    const hour = rng.weighted<number>([
      [6, 2], [7, 5], [8, 8], [9, 9], [10, 9], [11, 8], [12, 7], [13, 7], [14, 8], [15, 8], [16, 8], [17, 7], [18, 6], [19, 4], [20, 3], [21, 2], [22, 1], [23, 1],
    ]);
    created = midnight + hour * HOUR + rng.int(0, 59) * MINUTE;
  }
  const latest = ctx.now - totalMinutes * MINUTE - rng.int(1, 6) * MINUTE;
  if (created > latest || (provider && plan.dayOffset === 0)) created = latest;

  let cursor = created;
  const timeline = steps.map((step) => {
    cursor += step.minutes * MINUTE;
    return { status: step.status, at: isoAt(Math.round(cursor / 1000) * 1000) };
  });
  timeline[0].at = isoAt(created);

  const extrasAmount = extrasFor(ctx.pricing, details, luandaHour(created), stops.length);
  let estimate = estimatePrice(ctx.pricing, { kind, distanceKm: distance, extrasAmount });
  let proposal: StoredRequest["proposal"];
  const assigned = targetIndex >= 1;
  if (kind === "house_move" && assigned && rng.chance(0.5)) {
    const amount = Math.round((estimate.serviceValue * rng.float(1.08, 1.35)) / 500) * 500;
    const early = plan.status === "assigned" || plan.status === "en_route";
    const status = early && rng.chance(0.5) ? "sent" : rng.chance(0.7) ? "accepted" : "declined";
    proposal = {
      amount,
      status,
      reason: rng.pick([
        "Mobília volumosa que exige um segundo ajudante.",
        "Acesso difícil ao prédio e escadas estreitas.",
        "Mais volume do que o indicado no pedido.",
      ]),
    };
    if (status === "accepted") estimate = priceWithProposal(ctx.pricing, estimate, amount);
  }

  let providerId: string | undefined;
  if (assigned) {
    if (provider) providerId = provider.id;
    else {
      const capable = providers.filter((item) => item.accountStatus !== "pending_approval" && item.services.includes(kind));
      const covering = capable.filter((item) => item.zoneIds.includes(base.zoneId));
      providerId = rng.pick(covering.length ? covering : capable).id;
    }
  }

  const request: StoredRequest = {
    ...base,
    providerId,
    createdAt: isoAt(created),
    price: estimate.breakdown,
    providerEarning: estimate.providerEarning,
    proposal,
    timeline,
  };

  if (plan.status === "cancelled") request.cancelReason = rng.pick(CANCEL_REASONS);
  const reached = (status: ServiceStatus) => timeline.some((event) => event.status === status);
  if (reached("delivered")) {
    request.proof = {
      receivedBy: rng.chance(0.7) ? client.name : `${rng.pick(CLIENT_FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      at: eventAt(request, "delivered") ?? request.createdAt,
      photoLabel: `Fotografia da entrega em ${destination.area}`,
    };
  }
  if (reached("rated")) {
    const rating = rng.weighted<number>([[5, 55], [4, 27], [3, 9], [2, 6], [1, 3]]);
    request.rating = rating;
    request.review = rng.chance(0.75) ? rng.pick(REVIEW_COMMENTS[rating]) : undefined;
  }
  return request;
}

function planRequests(ctx: Context, providers: ProviderAccount[]): RequestPlan[] {
  const { rng, now } = ctx;
  const plans: RequestPlan[] = [];
  for (const minutes of [16, 22, 31, 38]) plans.push({ status: "searching", createdAt: now - minutes * MINUTE, dayOffset: 0 });
  plans.push({ status: "searching", createdAt: now - 3 * MINUTE, dayOffset: 0 });

  const pool = rng.shuffle(providers.filter((provider) => eligibleNow(provider, ctx.today) && provider.id !== SEED_ELIGIBLE_AFTER_APPROVAL));
  const activeStatuses: ServiceStatus[] = ["assigned", "en_route", "arrived", "pickup_confirmed", "in_transit", "in_transit"];
  activeStatuses.forEach((status, position) => {
    const provider = pool[position];
    if (!provider) return;
    provider.availability = "online";
    plans.push({ status, provider, dayOffset: 0 });
  });
  for (const status of ["rated", "paid", "delivered", "cancelled", "rated"] as ServiceStatus[]) {
    plans.push({ status, dayOffset: 0, cancelFrom: status === "cancelled" ? "assigned" : undefined });
  }
  while (plans.length < 300) {
    const dayOffset = rng.int(1, 59);
    const status = rng.weighted<ServiceStatus>(
      dayOffset <= 2
        ? [["rated", 58], ["paid", 14], ["delivered", 8], ["cancelled", 14]]
        : [["rated", 70], ["paid", 14], ["cancelled", 15]],
    );
    plans.push({
      status,
      dayOffset,
      cancelFrom: status === "cancelled" ? rng.weighted<ServiceStatus>([["searching", 45], ["assigned", 25], ["en_route", 20], ["arrived", 10]]) : undefined,
    });
  }
  return plans;
}

function buildTickets(ctx: Context, state: Pick<MockState, "clients" | "providers" | "requests" | "adminUsers">): Ticket[] {
  const { rng } = ctx;
  const handlers = state.adminUsers.filter((user) => user.active && (user.role === "support" || user.role === "admin"));
  const statuses: Ticket["status"][] = [...Array(9).fill("open"), ...Array(8).fill("in_progress"), ...Array(8).fill("resolved")];
  return statuses.map((status, index) => {
    const fromClient = index % 3 !== 2;
    const requester = fromClient ? rng.pick(state.clients) : rng.pick(state.providers.filter((provider) => provider.accountStatus !== "pending_approval"));
    const related = state.requests.filter((request) => (fromClient ? request.clientId : request.providerId) === requester.id);
    const request = related.length && rng.chance(0.8) ? rng.pick(related) : undefined;
    const created = ctx.now - rng.int(30, 60 * 24 * 20) * MINUTE;
    const messages: TicketMessage[] = [
      {
        id: `msg-${pad(index + 1)}-1`,
        author: fromClient ? "client" : "provider",
        authorName: requester.name,
        body: fromClient
          ? "Bom dia. Tive um problema com o meu pedido e gostaria de ajuda, por favor."
          : "Boa tarde. Preciso de ajuda com a minha conta de prestador.",
        at: isoAt(created),
      },
    ];
    const assignee = status === "open" && rng.chance(0.6) ? undefined : rng.pick(handlers);
    let updated = created;
    if (status !== "open") {
      const replies = rng.int(1, 2);
      for (let reply = 0; reply < replies; reply += 1) {
        updated += rng.int(20, 600) * MINUTE;
        messages.push({
          id: `msg-${pad(index + 1)}-${messages.length + 1}`,
          author: "admin",
          authorName: assignee?.name ?? "Suporte Leva Já",
          body: rng.pick(ADMIN_REPLIES),
          at: isoAt(Math.min(updated, ctx.now - MINUTE)),
        });
      }
    }
    const resolvedAt = status === "resolved" ? isoAt(Math.min(updated + rng.int(30, 300) * MINUTE, ctx.now - MINUTE)) : undefined;
    return {
      id: `tkt-${pad(index + 1)}`,
      code: `OC-${1001 + index}`,
      subject: rng.pick(fromClient ? CLIENT_TICKET_SUBJECTS : PROVIDER_TICKET_SUBJECTS),
      status,
      priority: rng.weighted<Ticket["priority"]>([["low", 20], ["medium", 45], ["high", 25], ["urgent", 10]]),
      requesterKind: fromClient ? "client" : "provider",
      requesterId: requester.id,
      requesterName: requester.name,
      requestId: request?.id,
      assigneeId: assignee?.id,
      assigneeName: assignee?.name,
      messages,
      createdAt: isoAt(created),
      updatedAt: resolvedAt ?? messages[messages.length - 1].at,
      resolvedAt,
      resolution: resolvedAt ? rng.pick(TICKET_RESOLUTIONS) : undefined,
    };
  });
}

function buildSos(ctx: Context, state: Pick<MockState, "clients" | "providers" | "requests" | "adminUsers">): SosAlert[] {
  const { rng } = ctx;
  const handler = state.adminUsers.find((user) => user.role === "operations")?.name;
  const active = state.requests.filter((request) => request.status === "in_transit" || request.status === "en_route");
  const historical = state.requests.filter((request) => request.status === "rated" && request.createdAt < isoAt(ctx.now - 2 * DAY));
  const make = (request: StoredRequest, index: number, open: boolean, minutesAgo: number): SosAlert => {
    const byProvider = index % 2 === 1;
    const party = byProvider
      ? state.providers.find((provider) => provider.id === request.providerId)
      : state.clients.find((client) => client.id === request.clientId);
    const createdAt = open ? ctx.now - minutesAgo * MINUTE : new Date(request.createdAt).getTime() + 25 * MINUTE;
    return {
      id: `sos-${pad(index + 1)}`,
      requestId: request.id,
      requestCode: request.code,
      raisedBy: byProvider ? "provider" : "client",
      raisedById: party?.id ?? "",
      raisedByName: party?.name ?? "",
      phone: party?.phone ?? "",
      coords: offset(request.origin.coords, 0.4, index),
      area: request.origin.area,
      message: [
        "A viatura avariou na via expressa e estou num local isolado.",
        "Sinto-me ameaçado no local de recolha. Preciso de ajuda.",
        "Acidente ligeiro durante o transporte, sem feridos.",
        "O cliente recusa-se a pagar e está agressivo.",
        "Fui abordado por desconhecidos durante a espera.",
        "Pneu rebentado na estrada de Catete.",
      ][index % 6],
      status: open ? "open" : "resolved",
      createdAt: isoAt(createdAt),
      acknowledgedAt: open ? undefined : isoAt(createdAt + 3 * MINUTE),
      resolvedAt: open ? undefined : isoAt(createdAt + rng.int(20, 90) * MINUTE),
      handledBy: open ? undefined : handler,
      resolution: open ? undefined : "Contactada a Polícia Nacional e o utilizador confirmou que está em segurança.",
    };
  };
  const alerts: SosAlert[] = [];
  active.slice(0, 2).forEach((request, index) => alerts.push(make(request, index, true, [6, 22][index])));
  rng.sample(historical, 4).forEach((request, index) => alerts.push(make(request, index + 2, false, 0)));
  return alerts;
}

function buildRefunds(ctx: Context, state: MockState): Refund[] {
  const { rng } = ctx;
  const candidates = state.requests.filter(
    (request) => (request.status === "paid" || request.status === "rated") && !request.dispute && request.createdAt > isoAt(ctx.now - 25 * DAY),
  );
  const support = state.adminUsers.find((user) => user.role === "support");
  const finance = state.adminUsers.find((user) => user.role === "finance");
  const plan: { status: Refund["status"]; share: number; source: Refund["source"]; chargeProvider: boolean; reason: string }[] = [
    { status: "pending", share: 0.3, source: "manual", chargeProvider: false, reason: "Valor cobrado em duplicado." },
    { status: "pending", share: 1, source: "manual", chargeProvider: true, reason: "Serviço não prestado: o prestador não chegou ao local." },
    { status: "approved", share: 0.2, source: "manual", chargeProvider: false, reason: "Atraso de mais de uma hora na recolha." },
    { status: "paid", share: 0.25, source: "manual", chargeProvider: true, reason: "Pequeno dano num móvel confirmado pelo prestador." },
    { status: "paid", share: 0.15, source: "cancellation", chargeProvider: false, reason: "Taxa de espera cobrada indevidamente." },
    { status: "rejected", share: 0.5, source: "manual", chargeProvider: false, reason: "Cliente diz que o valor final foi alto." },
  ];
  return rng.sample(candidates, Math.min(plan.length, candidates.length)).map((request, index) => {
    const step = plan[index];
    const client = state.clients.find((item) => item.id === request.clientId);
    const provider = state.providers.find((item) => item.id === request.providerId);
    const paidAt = new Date(eventAt(request, "paid") ?? request.createdAt).getTime();
    const requested = Math.min(paidAt + rng.int(4, 30) * HOUR, ctx.now - 2 * HOUR);
    const decided = Math.min(requested + rng.int(2, 12) * HOUR, ctx.now - HOUR);
    const amount = Math.max(500, Math.round((request.price.total * step.share) / 100) * 100);
    return {
      id: `rf-${pad(index + 1)}`,
      code: `RE-${1001 + index}`,
      requestId: request.id,
      requestCode: request.code,
      clientId: request.clientId,
      clientName: client?.name ?? "Cliente",
      providerId: provider?.id,
      providerName: provider?.name,
      amount: Math.min(amount, request.price.total),
      reason: step.reason,
      source: step.source,
      chargeProvider: step.chargeProvider && Boolean(provider),
      method: request.paymentMethod ?? "card",
      status: step.status,
      requestedAt: isoAt(requested),
      requestedBy: support?.name ?? "Suporte Leva Já",
      requestedById: support?.id ?? "adm-support",
      decidedAt: step.status === "pending" ? undefined : isoAt(decided),
      decidedBy: step.status === "pending" ? undefined : finance?.name,
      decisionReason: step.status === "rejected" ? "O valor corresponde à distância e aos extras confirmados." : undefined,
      paidAt: step.status === "paid" ? isoAt(Math.min(decided + 4 * HOUR, ctx.now - 30 * MINUTE)) : undefined,
      paymentReference: step.status === "paid" ? `DEV${rng.int(100000, 999999)}` : undefined,
    };
  });
}

function buildSettlements(ctx: Context, state: MockState): StoredSettlement[] {
  const { rng } = ctx;
  const from = addDays(ctx.today, -21);
  const to = addDays(ctx.today, -1);
  const expected = expectedSettlements(state, from, to);
  const finance = state.adminUsers.find((user) => user.role === "finance");
  const keys = [...expected.keys()].sort();
  const mismatches = new Set(rng.sample(keys.slice(0, -2), 3));
  const resolved = [...mismatches][0];
  const pending = keys.filter((key) => key.startsWith(to));
  return keys.flatMap((key) => {
    const [day, method] = key.split(":") as [string, SettlementMethod];
    if (pending.includes(key)) return [];
    const total = expected.get(key)?.expected ?? 0;
    const difference = mismatches.has(key) ? rng.pick([-3500, -1200, 2500]) : 0;
    const receivedAt = isoAt(new Date(`${addDays(day, 1)}T09:00:00+01:00`).getTime() + rng.int(0, 120) * MINUTE);
    return [
      {
        id: settlementId(day, method),
        day,
        method,
        received: total + difference,
        reference: `${method === "card" ? "GW" : "EMIS"}-${day.replace(/-/g, "")}-${rng.int(100, 999)}`,
        receivedAt,
        resolution: key === resolved ? "Comissão da gateway descontada no extracto; confirmada com o banco." : undefined,
        resolvedBy: key === resolved ? finance?.name : undefined,
        resolvedAt: key === resolved ? isoAt(new Date(receivedAt).getTime() + 5 * HOUR) : undefined,
      },
    ];
  });
}

function buildCashDeposits(ctx: Context, state: MockState): CashDeposit[] {
  const { rng } = ctx;
  const finance = state.adminUsers.find((user) => user.role === "finance");
  const deposits: CashDeposit[] = [];
  const providers = state.providers.filter((provider) => cashCharges(state, provider.id).length > 0);
  providers.forEach((provider, index) => {
    const charges = cashCharges(state, provider.id).sort((a, b) => (a.at < b.at ? -1 : 1));
    const cutoffDays = index % 4 === 0 ? 12 : rng.int(1, 5);
    const cutoff = isoAt(ctx.now - cutoffDays * DAY);
    const covered = charges.filter((charge) => charge.at < cutoff);
    let pending = covered.reduce((sum, charge) => sum + charge.amount, 0);
    let at = covered.length ? new Date(covered[0].at).getTime() + 2 * DAY : 0;
    let count = 0;
    while (pending > 0 && count < 4) {
      const amount = count === 3 ? pending : Math.min(pending, Math.ceil((pending * rng.float(0.4, 0.7)) / 100) * 100);
      deposits.push({
        id: `cd-${pad(deposits.length + 1)}`,
        providerId: provider.id,
        providerName: provider.name,
        amount,
        reference: `DEP${rng.int(100000, 999999)}`,
        at: isoAt(Math.min(at, ctx.now - cutoffDays * DAY + HOUR)),
        recordedBy: finance?.name ?? "Finanças",
      });
      pending -= amount;
      at += rng.int(2, 5) * DAY;
      count += 1;
    }
  });
  return deposits;
}

function buildPayoutBatches(ctx: Context, state: MockState): PayoutBatch[] {
  const finance = state.adminUsers.find((user) => user.role === "finance");
  const paid = state.withdrawals
    .filter((withdrawal) => withdrawal.status === "paid" && withdrawal.paidAt)
    .sort((a, b) => ((a.paidAt ?? "") < (b.paidAt ?? "") ? -1 : 1));
  const groups = [paid.slice(0, 4), paid.slice(4, 8)].filter((group) => group.length > 0);
  return groups.map((group, index) => {
    const id = `lp-${pad(index + 1)}`;
    const paidAt = group[group.length - 1].paidAt ?? isoAt(ctx.now);
    const bankReference = `BAI${ctx.rng.int(100000, 999999)}`;
    group.forEach((withdrawal, position) => {
      withdrawal.batchId = id;
      withdrawal.paymentReference = `${bankReference}/${position + 1}`;
    });
    return {
      id,
      code: `LP-${String(index + 1).padStart(4, "0")}`,
      status: "paid",
      withdrawalIds: group.map((withdrawal) => withdrawal.id),
      total: group.reduce((sum, withdrawal) => sum + withdrawal.amount, 0),
      count: group.length,
      createdAt: isoAt(new Date(group[0].decidedAt ?? group[0].requestedAt).getTime()),
      createdBy: finance?.name ?? "Finanças",
      sentAt: isoAt(new Date(paidAt).getTime() - 3 * HOUR),
      paidAt,
      bankReference,
    };
  });
}

function buildFleets(ctx: Context, state: MockState): Fleet[] {
  const fleets: Fleet[] = [
    { id: "flt-01", name: "Kianda Transportes", nif: "5417203398", contactName: "Paulo Kianda", phone: "+244 923 410 552", email: "geral@kiandatransportes.ao", status: "active", createdAt: isoAt(ctx.now - 210 * DAY) },
    { id: "flt-02", name: "Mudanças Rápidas Talatona", nif: "5000874412", contactName: "Isabel Nzinga", phone: "+244 912 778 031", email: "operacoes@mudancasrapidas.ao", status: "active", createdAt: isoAt(ctx.now - 140 * DAY) },
    {
      id: "flt-03",
      name: "Reboques Cacuaco",
      nif: "5419981207",
      contactName: "Mateus Bento",
      phone: "+244 935 002 418",
      email: "reboques.cacuaco@gmail.com",
      status: "suspended",
      suspensionReason: "Seguro de responsabilidade civil da frota expirado.",
      createdAt: isoAt(ctx.now - 320 * DAY),
    },
  ];
  const plan: [string, number[]][] = [
    ["flt-01", [1, 5, 9, 13]],
    ["flt-02", [2, 6, 10]],
    ["flt-03", [0, 20]],
  ];
  for (const [fleetId, indexes] of plan) {
    for (const index of indexes) {
      const provider = state.providers[index];
      if (provider) provider.fleetId = fleetId;
    }
  }
  return fleets;
}

function buildApplications(ctx: Context, state: MockState): ProviderApplication[] {
  const { rng } = ctx;
  const operations = state.adminUsers.find((user) => user.role === "operations")?.name ?? "Operações";
  const stages: ApplicationStage[] = [
    "submitted", "submitted", "submitted",
    "documents", "documents", "documents",
    "interview", "interview",
    "inspection", "inspection",
    "approved", "approved", "approved",
    "rejected", "rejected",
  ];
  const classes: VehicleClass[] = ["pickup", "van", "truck", "tow_truck"];
  return stages.map((stage, index) => {
    const vehicleClass = classes[index % classes.length];
    const [brand, model] = rng.pick(VEHICLE_MODELS[vehicleClass]);
    const name = personName(rng, rng.pick(CLIENT_FIRST_NAMES));
    const daysAgo = stage === "approved" || stage === "rejected" ? rng.int(8, 40) : stage === "submitted" ? rng.int(0, 2) : rng.int(2, 12);
    const submitted = ctx.now - daysAgo * DAY - rng.int(1, 10) * HOUR;
    const flow: ApplicationStage[] = ["submitted", "documents", "interview", "inspection"];
    const reached = stage === "approved" ? 4 : stage === "rejected" ? rng.int(1, 3) : flow.indexOf(stage) + 1;
    const step = Math.max(HOUR, ((ctx.now - submitted) / (reached + 1)) * 0.8);
    const history: ProviderApplication["history"] = flow.slice(0, reached).map((item, position) => ({
      stage: item,
      at: isoAt(submitted + position * step),
      by: position === 0 ? name : operations,
    }));
    if (stage === "approved" || stage === "rejected") history.push({ stage, at: isoAt(submitted + reached * step), by: operations });
    const zone = state.zones[index % state.zones.length];
    const documentsReceived: ProviderApplication["documentsReceived"] =
      stage === "submitted" ? [] : stage === "documents" ? (index % 2 === 0 ? ["id", "license"] : ["id", "license", "vehicle", "insurance"]) : ["id", "license", "vehicle", "insurance"];
    const interviewAt =
      stage === "interview" ? isoAt(index % 2 === 0 ? ctx.now + rng.int(4, 48) * HOUR : ctx.now - rng.int(2, 20) * HOUR) : reached >= 3 ? history[2]?.at : undefined;
    const inspected = stage === "approved" || (stage === "inspection" && index % 2 === 0);
    return {
      id: `app-${pad(index + 1)}`,
      code: `CA-${1001 + index}`,
      name,
      phone: phone(rng),
      email: `${slugify(name)}@gmail.com`,
      vehicleClass,
      vehicleLabel: `${brand} ${model}`,
      plate: plate(rng),
      zoneId: zone.id,
      services: [...VEHICLE_SERVICES[vehicleClass]],
      fleetId: index === 4 || index === 9 ? "flt-01" : undefined,
      source: index === 4 || index === 9 ? "fleet" : rng.pick(["app", "app", "site", "referral"] as const),
      submittedAt: isoAt(submitted),
      stage,
      history,
      documentsReceived,
      interviewAt,
      inspection: inspected ? { passed: true, notes: "Viatura em bom estado; pneus e luzes conformes.", at: isoAt(ctx.now - rng.int(2, 30) * HOUR), by: operations } : undefined,
      rejectionReason: stage === "rejected" ? rng.pick(["Carta de condução com menos de dois anos.", "Viatura reprovada na vistoria: travões gastos.", "Não compareceu à entrevista."]) : undefined,
    };
  });
}

function buildPenalties(ctx: Context, state: MockState): Penalty[] {
  const operations = state.adminUsers.find((user) => user.role === "operations")?.name ?? "Operações";
  const at = (days: number) => isoAt(ctx.now - days * DAY);
  const provider = (index: number) => state.providers[index];
  const penalties: Penalty[] = [];
  const add = (index: number, penalty: Omit<Penalty, "id" | "providerId" | "providerName">) => {
    const target = provider(index);
    if (!target) return;
    penalties.push({ id: `pen-${pad(penalties.length + 1)}`, providerId: target.id, providerName: target.name, ...penalty });
  };
  add(7, { kind: "warning", reason: "Atraso de 40 minutos na recolha sem aviso ao cliente.", createdAt: at(6), createdBy: operations });
  add(11, { kind: "fine", amount: 5000, reason: "Cobrança de taxa de espera não prevista.", createdAt: at(9), createdBy: operations });
  add(15, {
    kind: "fine",
    amount: 3000,
    reason: "Cancelamento depois de chegar ao local.",
    createdAt: at(20),
    createdBy: operations,
    revokedAt: at(18),
    revokedBy: "Armando Silva",
    revokeReason: "O cliente confirmou que pediu o cancelamento.",
  });
  const suspended = provider(21);
  if (suspended && suspended.accountStatus === "suspended") {
    const until = isoAt(ctx.now + 5 * DAY);
    add(21, { kind: "suspension", days: 7, until, reason: "Cancelamentos repetidos depois de aceitar pedidos.", createdAt: at(2), createdBy: operations });
    suspended.suspendedUntil = until;
  }
  for (const penalty of penalties) syncPenaltyTransaction(state, penalty);
  return penalties;
}

function buildScheduled(ctx: Context, state: MockState): StoredRequest[] {
  const { rng } = ctx;
  const templates = state.requests.filter((request) => request.status === "rated" && !request.dispute && request.stops.length === 0);
  const busy = new Set(state.requests.filter((request) => request.providerId && ACTIVE_STATUSES.includes(request.status)).map((request) => request.providerId));
  const free = state.providers.filter((provider) => eligibleNow(provider, ctx.today) && !busy.has(provider.id));
  const plan: { hours: number; assigned: boolean }[] = [
    { hours: 1.5, assigned: false },
    { hours: 2.5, assigned: false },
    { hours: 5, assigned: true },
    { hours: 9, assigned: false },
    { hours: 20, assigned: true },
    { hours: 26, assigned: false },
    { hours: 30, assigned: true },
    { hours: 50, assigned: false },
    { hours: 75, assigned: true },
    { hours: 98, assigned: false },
    { hours: 140, assigned: false },
    { hours: 190, assigned: true },
  ];
  const lastCode = state.requests.reduce((max, request) => Math.max(max, Number(request.code.replace(/\D/g, "")) || 0), 0);
  return plan.flatMap((step, index) => {
    const template = templates[(index * 7) % Math.max(1, templates.length)];
    if (!template) return [];
    const scheduled = Math.round((ctx.now + step.hours * HOUR) / (15 * MINUTE)) * 15 * MINUTE;
    const created = ctx.now - rng.int(2, 60) * HOUR;
    const provider = step.assigned ? free.find((item) => item.services.includes(template.kind) && item.zoneIds.includes(template.zoneId)) ?? free[index % Math.max(1, free.length)] : undefined;
    const timeline: StoredRequest["timeline"] = [{ status: "searching", at: isoAt(created) }];
    if (provider) timeline.push({ status: "assigned", at: isoAt(created + rng.int(10, 90) * MINUTE) });
    return [
      {
        ...template,
        id: `req-sch-${pad(index + 1, 2)}`,
        code: `LJ-${lastCode + index + 1}`,
        status: provider ? "assigned" : "searching",
        providerId: provider?.id,
        createdAt: isoAt(created),
        scheduledFor: isoAt(scheduled),
        timeline,
        rating: undefined,
        review: undefined,
        proof: undefined,
        dispute: undefined,
        paymentMethod: template.paymentMethod,
        photos: undefined,
      },
    ];
  });
}

const PICKUP_PHOTOS = ["Carga embalada antes da recolha", "Viatura carregada no local de recolha", "Estado da viatura rebocada na recolha"];
const DELIVERY_PHOTOS = ["Carga descarregada no destino", "Entrega confirmada à porta", "Viatura entregue na oficina"];

function addPhotos(ctx: Context, state: MockState) {
  const since = isoAt(ctx.now - 21 * DAY);
  state.requests.forEach((request, index) => {
    const picked = eventAt(request, "pickup_confirmed");
    const delivered = eventAt(request, "delivered");
    if (!picked || request.createdAt < since) return;
    const photos: NonNullable<StoredRequest["photos"]> = [
      { id: `ph-${request.id}-1`, stage: "pickup", label: PICKUP_PHOTOS[index % PICKUP_PHOTOS.length], at: picked, by: "provider" },
    ];
    if (index % 3 === 0) photos.push({ id: `ph-${request.id}-2`, stage: "pickup", label: "Pormenor da carga", at: picked, by: "provider" });
    if (delivered) photos.push({ id: `ph-${request.id}-3`, stage: "delivery", label: DELIVERY_PHOTOS[index % DELIVERY_PHOTOS.length], at: delivered, by: "provider" });
    if (request.dispute?.category === "damage" && delivered) {
      photos.push(
        { id: `ph-${request.id}-4`, stage: "damage", label: "Risco na porta do armário", at: delivered, by: "client" },
        { id: `ph-${request.id}-5`, stage: "damage", label: "Canto da mesa partido", at: delivered, by: "client" },
      );
    }
    request.photos = photos;
  });
}

function buildClaims(ctx: Context, state: MockState): Claim[] {
  const support = state.adminUsers.find((user) => user.role === "support")?.name ?? "Suporte";
  const finance = state.adminUsers.find((user) => user.role === "finance")?.name ?? "Finanças";
  const damaged = state.requests.find((request) => request.dispute?.category === "damage" && !request.dispute.resolvedAt);
  const settled = state.requests.filter((request) => (request.status === "rated" || request.status === "paid") && !request.dispute && request.createdAt > isoAt(ctx.now - 40 * DAY));
  const sources = [damaged, settled[2], settled[9], settled[15], settled[21], settled[30]].filter((request): request is StoredRequest => Boolean(request));
  const plan: { kind: Claim["kind"]; status: Claim["status"]; amount: number; description: string }[] = [
    { kind: "cargo_damage", status: "reported", amount: 45_000, description: "Armário e mesa danificados durante a descarga, segundo o cliente." },
    { kind: "vehicle_damage", status: "under_review", amount: 120_000, description: "Pára-choques da viatura rebocada riscado durante o carregamento." },
    { kind: "accident", status: "under_review", amount: 350_000, description: "Colisão ligeira na Via Expressa com a carga a bordo; sem feridos." },
    { kind: "cargo_damage", status: "approved", amount: 28_000, description: "Televisor com o ecrã partido depois do transporte." },
    { kind: "theft", status: "rejected", amount: 60_000, description: "Cliente diz que faltava uma caixa na entrega." },
    { kind: "cargo_damage", status: "paid", amount: 15_000, description: "Cadeiras riscadas na mudança." },
  ];
  return sources.map((request, index) => {
    const step = plan[index];
    const client = state.clients.find((item) => item.id === request.clientId);
    const provider = state.providers.find((item) => item.id === request.providerId);
    const occurred = Date.parse(eventAt(request, "delivered") ?? request.createdAt);
    const reported = Math.min(occurred + (index + 2) * HOUR, ctx.now - HOUR);
    const decided = Math.min(reported + 2 * DAY, ctx.now - 30 * MINUTE);
    const reviewed = step.status !== "reported";
    const decidedStatus = step.status === "approved" || step.status === "rejected" || step.status === "paid";
    return {
      id: `sn-${pad(index + 1)}`,
      code: `SN-${1001 + index}`,
      requestId: request.id,
      requestCode: request.code,
      clientId: request.clientId,
      clientName: client?.name ?? "Cliente",
      providerId: provider?.id,
      providerName: provider?.name,
      kind: step.kind,
      description: step.description,
      occurredAt: isoAt(occurred),
      reportedAt: isoAt(reported),
      reportedBy: support,
      estimatedAmount: step.amount,
      status: step.status,
      insurer: reviewed ? (index % 2 ? "ENSA Seguros" : "Fidelidade Angola") : undefined,
      policyNumber: reviewed ? `AP-${2026}-${String(40_000 + index * 137).padStart(6, "0")}` : undefined,
      approvedAmount: step.status === "approved" || step.status === "paid" ? Math.round(step.amount * 0.8) : undefined,
      decisionReason: step.status === "rejected" ? "A guia de entrega assinada pelo cliente indica todas as caixas." : decidedStatus ? "Dano confirmado pelas fotografias da entrega." : undefined,
      decidedAt: decidedStatus ? isoAt(decided) : undefined,
      decidedBy: decidedStatus ? finance : undefined,
      paidAt: step.status === "paid" ? isoAt(Math.min(decided + DAY, ctx.now - 10 * MINUTE)) : undefined,
      paymentReference: step.status === "paid" ? `IND${700_100 + index}` : undefined,
      notes: reviewed ? [{ id: `sno-${index + 1}`, author: support, text: "Pedidas fotografias e guia de entrega ao prestador.", at: isoAt(reported + 3 * HOUR) }] : [],
      photoIds: (request.photos ?? []).filter((photo) => photo.stage === "damage").map((photo) => photo.id),
    };
  });
}

function buildBusinessAccounts(ctx: Context, state: MockState): BusinessAccount[] {
  const start = isoAt(ctx.now - 150 * DAY);
  const end = isoAt(ctx.now + 215 * DAY);
  const accounts: BusinessAccount[] = [
    {
      id: "emp-01",
      name: "Sonangol Logística",
      nif: "5410002871",
      sector: "Energia",
      contactName: "Marta Gaspar",
      phone: "+244 923 118 940",
      email: "compras@sonangol-logistica.ao",
      status: "active",
      contract: { startsAt: start, endsAt: end, discountRate: 0.1, paymentTermsDays: 30, creditLimit: 400_000 },
      clientIds: state.clients.slice(0, 4).map((client) => client.id),
      statements: [],
      createdAt: start,
    },
    {
      id: "emp-02",
      name: "Shoprite Angola",
      nif: "5403318820",
      sector: "Retalho",
      contactName: "Daniel Fortunato",
      phone: "+244 912 440 207",
      email: "frota@shoprite.co.ao",
      status: "active",
      contract: { startsAt: start, endsAt: end, discountRate: 0.07, paymentTermsDays: 15, creditLimit: 150_000 },
      clientIds: state.clients.slice(4, 7).map((client) => client.id),
      statements: [],
      createdAt: isoAt(ctx.now - 120 * DAY),
    },
    {
      id: "emp-03",
      name: "Clínica Girassol",
      nif: "5417790012",
      sector: "Saúde",
      contactName: "Rosa Tchivinda",
      phone: "+244 934 880 115",
      email: "administracao@clinicagirassol.ao",
      status: "suspended",
      suspensionReason: "Dois extractos em atraso.",
      contract: { startsAt: start, endsAt: end, discountRate: 0.05, paymentTermsDays: 30, creditLimit: 80_000 },
      clientIds: state.clients.slice(7, 9).map((client) => client.id),
      statements: [],
      createdAt: isoAt(ctx.now - 140 * DAY),
    },
  ];
  const currentMonth = luandaDay(new Date(ctx.now)).slice(0, 7);
  for (const account of accounts) {
    const months = new Set(
      state.requests
        .filter((request) => account.clientIds.includes(request.clientId) && (request.status === "paid" || request.status === "rated"))
        .map((request) => luandaDay(eventAt(request, "paid") ?? request.createdAt).slice(0, 7)),
    );
    const closed = [...months].filter((month) => month < currentMonth).sort();
    const unpaid = account.status === "suspended" ? 2 : account.id === "emp-02" ? 1 : 1;
    account.statements = closed.slice(0, Math.max(0, closed.length - unpaid)).map((month, index) => ({
      month,
      paidAt: isoAt(new Date(`${month}-01T12:00:00Z`).getTime() + 40 * DAY),
      reference: `EMP${account.id.slice(-2)}${String(index + 1).padStart(3, "0")}`,
    }));
  }
  return accounts;
}

function buildPromotions(ctx: Context, state: MockState): Promotion[] {
  const operations = state.adminUsers.find((user) => user.role === "finance")?.name ?? "Finanças";
  const at = (days: number) => isoAt(ctx.now + days * DAY);
  const base = { maxDiscount: undefined, zoneIds: [] as string[], paused: false, createdBy: operations };
  const promotions: Promotion[] = ([
    { ...base, id: "promo-01", code: "LEVAJA10", name: "10 % em qualquer serviço", kind: "percent", value: 10, maxDiscount: 3000, minOrder: 5000, services: [], startsAt: at(-25), endsAt: at(20), budget: 150_000, perClientLimit: 3, firstOrderOnly: false, createdAt: at(-26) },
    { ...base, id: "promo-02", code: "MUDA2000", name: "2 000 Kz nas mudanças", kind: "fixed", value: 2000, minOrder: 10_000, services: ["small_move", "house_move"], startsAt: at(-18), endsAt: at(12), budget: 60_000, perClientLimit: 1, firstOrderOnly: false, createdAt: at(-19) },
    { ...base, id: "promo-03", code: "BEMVINDO", name: "Primeiro pedido com 15 %", kind: "percent", value: 15, maxDiscount: 2500, minOrder: 0, services: [], startsAt: at(-60), endsAt: at(-5), budget: 80_000, perClientLimit: 1, firstOrderOnly: true, createdAt: at(-61), endedAt: at(-5) },
    { ...base, id: "promo-04", code: "REBOQUE500", name: "500 Kz nos reboques", kind: "fixed", value: 500, minOrder: 0, services: ["tow"], startsAt: at(-10), endsAt: at(30), budget: 20_000, perClientLimit: 2, firstOrderOnly: false, paused: true, createdAt: at(-11) },
    { ...base, id: "promo-05", code: "NATAL15", name: "Natal com 15 %", kind: "percent", value: 15, maxDiscount: 4000, minOrder: 8000, services: [], startsAt: at(55), endsAt: at(70), budget: 200_000, perClientLimit: 2, firstOrderOnly: false, createdAt: at(-2) },
  ] as Omit<Promotion, "uses">[]).map((promotion) => ({ ...promotion, uses: [] }));
  const settled = state.requests.filter((request) => request.status === "paid" || request.status === "rated").sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const firstByClient = new Map<string, string>();
  for (const request of settled) if (!firstByClient.has(request.clientId)) firstByClient.set(request.clientId, request.id);
  settled.forEach((request, index) => {
    const promotion = promotions[index % 4];
    if (index % 3 !== 0) return;
    if (request.createdAt < promotion.startsAt || request.createdAt > (promotion.endedAt ?? promotion.endsAt)) return;
    if (promotion.services.length && !promotion.services.includes(request.kind)) return;
    if (request.price.total < promotion.minOrder) return;
    if (promotion.firstOrderOnly && firstByClient.get(request.clientId) !== request.id) return;
    if (promotion.uses.filter((use) => use.clientId === request.clientId).length >= promotion.perClientLimit) return;
    const raw = promotion.kind === "percent" ? Math.round((request.price.total * promotion.value) / 100) : promotion.value;
    const discount = Math.min(raw, promotion.maxDiscount ?? raw, request.price.total);
    if (promotion.uses.reduce((sum, use) => sum + use.discount, 0) + discount > promotion.budget) return;
    promotion.uses.push({ requestId: request.id, clientId: request.clientId, discount, at: request.createdAt });
  });
  return promotions;
}

function buildBroadcasts(ctx: Context, state: MockState): Broadcast[] {
  const support = state.adminUsers.find((user) => user.role === "support")?.name ?? "Suporte";
  return [
    {
      id: "com-01",
      title: "Lançamento das mudanças de casa",
      channel: "push",
      audience: { kind: "clients", segment: "all", zoneIds: [] },
      message: "Olá {nome}! Já pode pedir mudanças de casa completas na Leva Já, com ajudantes incluídos.",
      status: "sent",
      sentAt: isoAt(ctx.now - 9 * DAY),
      recipients: 38,
      delivered: 37,
      failed: 1,
      createdAt: isoAt(ctx.now - 10 * DAY),
      createdBy: support,
    },
    {
      id: "com-02",
      title: "Documentos a expirar",
      channel: "sms",
      audience: { kind: "providers", segment: "all", zoneIds: [] },
      message: "Leva Já: {nome}, confirme na app que os seus documentos estão válidos para continuar a receber pedidos.",
      status: "sent",
      sentAt: isoAt(ctx.now - 4 * DAY),
      recipients: 22,
      delivered: 21,
      failed: 1,
      createdAt: isoAt(ctx.now - 4 * DAY - 2 * HOUR),
      createdBy: support,
    },
    {
      id: "com-03",
      title: "Promoção de Natal",
      channel: "email",
      audience: { kind: "clients", segment: "inactive_30", zoneIds: [] },
      subject: "15 % de desconto no Natal",
      message: "Olá {nome}, neste Natal use o código NATAL15 e tenha 15 % de desconto no próximo serviço.",
      status: "scheduled",
      scheduledFor: isoAt(ctx.now + 55 * DAY),
      createdAt: isoAt(ctx.now - DAY),
      createdBy: support,
    },
    {
      id: "com-04",
      title: "Aviso de chuva em Luanda",
      channel: "push",
      audience: { kind: "providers", segment: "online", zoneIds: [] },
      message: "Atenção {nome}: chuva forte prevista para hoje à tarde. Conduza com cuidado e avise o cliente de atrasos.",
      status: "draft",
      createdAt: isoAt(ctx.now - 3 * HOUR),
      createdBy: support,
    },
  ];
}

function buildWithdrawals(ctx: Context, state: MockState) {
  const { rng } = ctx;
  const providers = state.providers
    .filter((provider) => provider.accountStatus !== "pending_approval")
    .map((provider) => ({ provider, available: providerBalance(state, provider.id) }))
    .filter((entry) => entry.available >= 20_000)
    .sort((a, b) => b.available - a.available);
  const plan: Withdrawal["status"][] = [
    ...Array(9).fill("paid"),
    ...Array(3).fill("rejected"),
    ...Array(2).fill("approved"),
    ...Array(6).fill("pending"),
  ];
  const finance = state.adminUsers.find((user) => user.role === "finance");
  const withdrawals: Withdrawal[] = [];
  plan.forEach((status, index) => {
    const entry = providers[index % providers.length];
    if (!entry) return;
    const share = status === "paid" ? rng.float(0.25, 0.45) : rng.float(0.15, 0.3);
    const amount = Math.max(5000, Math.floor((entry.available * share) / 1000) * 1000);
    if (status !== "rejected" && amount > entry.available) return;
    if (status !== "rejected") entry.available -= amount;
    const daysAgo = status === "paid" ? rng.int(4, 45) : status === "rejected" ? rng.int(3, 30) : status === "approved" ? rng.int(1, 2) : 0;
    const requested = ctx.now - daysAgo * DAY - rng.int(1, 20) * HOUR;
    const decided = requested + rng.int(2, 20) * HOUR;
    const id = `wd-${pad(index + 1)}`;
    const withdrawal: Withdrawal = {
      id,
      providerId: entry.provider.id,
      providerName: entry.provider.name,
      amount,
      iban: iban(rng),
      status,
      requestedAt: isoAt(requested),
      decidedAt: status === "pending" ? undefined : isoAt(Math.min(decided, ctx.now - HOUR)),
      decidedBy: status === "pending" ? undefined : finance?.name,
      paidAt: status === "paid" ? isoAt(Math.min(decided + 6 * HOUR, ctx.now - HOUR)) : undefined,
      paymentReference: status === "paid" ? `TRF${rng.int(100000, 999999)}` : undefined,
      reason: status === "rejected" ? rng.pick(["O IBAN não corresponde ao titular da conta.", "Pedido duplicado.", "Saldo em disputa."]) : undefined,
    };
    withdrawals.push(withdrawal);
    if (status === "paid") {
      state.transactions.push({
        id: `tx-${id}`,
        kind: "withdrawal",
        title: `Levantamento para IBAN …${withdrawal.iban.slice(-6).replace(" ", "")}`,
        amount: -amount,
        at: withdrawal.paidAt ?? withdrawal.requestedAt,
        status: "completed",
        providerId: entry.provider.id,
        providerName: entry.provider.name,
      });
    }
  });
  return withdrawals;
}

function buildAudit(ctx: Context, state: MockState): AuditLogEntry[] {
  const { rng } = ctx;
  const byRole = (role: AdminUser["role"]) => state.adminUsers.find((user) => user.role === role) ?? state.adminUsers[0];
  const entries: Omit<AuditLogEntry, "id">[] = [];
  const actor = (user: AdminUser) => ({ actorId: user.id, actorName: user.name, actorRole: user.role });
  for (const user of state.adminUsers.filter((item) => item.active).slice(0, 4)) {
    entries.push({ ...actor(user), action: "session.login", entity: { kind: "session", id: user.id, label: user.email }, at: user.lastLoginAt ?? isoAt(ctx.now - DAY) });
  }
  entries.push({
    ...actor(byRole("admin")),
    action: "pricing.update",
    entity: { kind: "pricing", id: "pricing", label: "Tabela de preços" },
    reason: "Actualização trimestral da tabela de preços.",
    changes: [{ field: "Taxa da plataforma", from: "400 Kz", to: "500 Kz" }],
    at: state.pricing.updatedAt,
  });
  for (const provider of state.providers.filter((item) => item.accountStatus === "suspended")) {
    entries.push({
      ...actor(byRole("operations")),
      action: "provider.suspend",
      entity: { kind: "provider", id: provider.id, label: provider.name },
      reason: provider.suspensionReason,
      changes: [{ field: "Estado da conta", from: "Activo", to: "Suspenso" }],
      at: isoAt(ctx.now - rng.int(2, 20) * DAY),
    });
  }
  for (const client of state.clients.filter((item) => item.blocked)) {
    entries.push({
      ...actor(byRole("support")),
      action: "client.block",
      entity: { kind: "client", id: client.id, label: client.name },
      reason: client.blockedReason,
      at: isoAt(ctx.now - rng.int(1, 10) * DAY),
    });
  }
  for (const withdrawal of state.withdrawals.filter((item) => item.status !== "pending")) {
    const action = withdrawal.status === "paid" ? "withdrawal.paid" : withdrawal.status === "rejected" ? "withdrawal.reject" : "withdrawal.approve";
    entries.push({
      ...actor(byRole("finance")),
      action,
      entity: { kind: "withdrawal", id: withdrawal.id, label: `${withdrawal.providerName} — ${formatKz(withdrawal.amount)}` },
      reason: withdrawal.reason ?? (withdrawal.paymentReference ? `Referência ${withdrawal.paymentReference}` : "Saldo confirmado."),
      at: withdrawal.paidAt ?? withdrawal.decidedAt ?? withdrawal.requestedAt,
    });
  }
  const verifiedDocs = state.providers
    .filter((provider) => provider.accountStatus === "active")
    .flatMap((provider) => provider.documents.map((document) => ({ provider, document })))
    .filter((entry) => entry.document.state === "verified");
  for (const { provider, document } of rng.sample(verifiedDocs, 6)) {
    entries.push({
      ...actor(byRole("operations")),
      action: "document.approve",
      entity: { kind: "document", id: document.id, label: `${document.title} — ${provider.name}` },
      reason: "Documento legível e dentro da validade.",
      changes: [{ field: "Estado", from: "Por validar", to: "Verificado" }],
      at: isoAt(ctx.now - rng.int(5, 50) * DAY),
    });
  }
  return entries
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map((entry, index) => ({ ...entry, id: `aud-${pad(entries.length - index, 4)}` }));
}

export function generateSeed(nowDate: Date = new Date(), seed = DEFAULT_SEED): MockState {
  const now = Math.floor(nowDate.getTime() / MINUTE) * MINUTE;
  const today = luandaDay(new Date(now));
  const rng = createRandom(seed);
  const pricing = defaultPricingConfig(isoAt(now - 21 * DAY), "Armando Silva");
  const ctx: Context = { rng, now, today, placeSeq: 0, pricing };

  const adminUsers = buildAdminUsers(now);
  const clients = buildClients(ctx);
  const { providers, submittedAt } = buildProviders(ctx);
  const plans = planRequests(ctx, providers);
  const requests = plans
    .map((plan, index) => buildRequest(ctx, index, plan, clients, providers))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((request, index) => ({ ...request, code: `LJ-${10421 + index}` }));

  for (const request of requests) {
    if (request.status === "searching" || !CANCELLABLE_STATUSES.includes(request.status)) continue;
    const provider = providers.find((item) => item.id === request.providerId);
    if (!provider) continue;
    const t = request.status === "en_route" ? 0.4 : 0;
    provider.coords = {
      latitude: Math.round((request.origin.coords.latitude + 0.01 * t) * 1e5) / 1e5,
      longitude: Math.round((request.origin.coords.longitude + 0.012 * t) * 1e5) / 1e5,
    };
  }
  for (const request of requests.filter((item) => item.status === "pickup_confirmed" || item.status === "in_transit")) {
    const provider = providers.find((item) => item.id === request.providerId);
    if (!provider) continue;
    const t = request.status === "in_transit" ? 0.5 : 0;
    provider.coords = {
      latitude: Math.round((request.origin.coords.latitude + (request.destination.coords.latitude - request.origin.coords.latitude) * t) * 1e5) / 1e5,
      longitude: Math.round((request.origin.coords.longitude + (request.destination.coords.longitude - request.origin.coords.longitude) * t) * 1e5) / 1e5,
    };
  }

  const recentSettled = requests.filter(
    (request) => ["delivered", "paid", "rated"].includes(request.status) && request.createdAt > isoAt(now - 8 * DAY) && request.createdAt < isoAt(now - DAY),
  );
  const disputeReasons = [
    "Cliente alega que a carga chegou danificada.",
    "Prestador diz que o cliente não pagou em numerário.",
    "Divergência no valor final da mudança.",
  ];
  const disputeCategories = ["damage", "payment", "price"] as const;
  const operations = adminUsers.find((user) => user.role === "operations");
  rng.sample(recentSettled, 3).forEach((request, index) => {
    const openedAt = Math.min(new Date(request.timeline[request.timeline.length - 1].at).getTime() + 2 * HOUR, now - HOUR);
    request.dispute = {
      reason: disputeReasons[index],
      category: disputeCategories[index],
      openedAt: isoAt(openedAt),
      openedBy: index === 0 ? operations?.name ?? "Operações" : "Suporte Leva Já",
      notes:
        index === 0
          ? [
              { id: `dn-${request.id}-1`, author: operations?.name ?? "Operações", text: "Pedidas fotografias da carga ao cliente.", at: isoAt(Math.min(openedAt + HOUR, now - 30 * MINUTE)) },
              { id: `dn-${request.id}-2`, author: "Suporte Leva Já", text: "Cliente enviou três fotografias; o prestador ainda não respondeu.", at: isoAt(Math.min(openedAt + 3 * HOUR, now - 20 * MINUTE)) },
            ]
          : [],
    };
  });
  const olderRated = requests.filter((request) => request.status === "rated" && !request.dispute && request.createdAt < isoAt(now - 15 * DAY));
  rng.sample(olderRated, 2).forEach((request) => {
    const opened = new Date(request.timeline[request.timeline.length - 1].at).getTime() + HOUR;
    request.dispute = {
      reason: "Cliente contestou o valor cobrado.",
      category: "price",
      openedAt: isoAt(opened),
      openedBy: "Suporte Leva Já",
      notes: [],
      resolvedAt: isoAt(opened + 2 * DAY),
      resolvedBy: "Armando Silva",
      resolution: "Valor confirmado pelo comprovativo de entrega.",
      outcome: "no_refund",
    };
  });

  const state: MockState = {
    version: MOCK_STATE_VERSION,
    seededAt: isoAt(now),
    savedAt: isoAt(now),
    zones: ZONES.map((zone) => ({ ...zone, coords: { ...zone.coords } })),
    pricing,
    settings: defaultPlatformSettings(isoAt(now - 30 * DAY), "Armando Silva"),
    rolePermissions: normalizeRolePermissions(),
    clients,
    providers,
    requests,
    transactions: [],
    withdrawals: [],
    refunds: [],
    settlements: [],
    cashDeposits: [],
    payoutBatches: [],
    applications: [],
    fleets: [],
    penalties: [],
    claims: [],
    businessAccounts: [],
    promotions: [],
    broadcasts: [],
    tickets: [],
    sos: [],
    reviewNotes: {},
    documentSubmittedAt: submittedAt,
    adminUsers,
    audit: [],
    sequence: 1000,
  };
  for (const request of requests) syncRequestTransactions(state, request);
  state.withdrawals = buildWithdrawals(ctx, state);
  state.refunds = buildRefunds(ctx, state);
  for (const refund of state.refunds) syncRefundTransaction(state, refund);
  state.settlements = buildSettlements(ctx, state);
  state.cashDeposits = buildCashDeposits(ctx, state);
  state.payoutBatches = buildPayoutBatches(ctx, state);
  state.fleets = buildFleets(ctx, state);
  state.applications = buildApplications(ctx, state);
  state.penalties = buildPenalties(ctx, state);
  state.requests.push(...buildScheduled(ctx, state));
  addPhotos(ctx, state);
  state.claims = buildClaims(ctx, state);
  state.businessAccounts = buildBusinessAccounts(ctx, state);
  state.promotions = buildPromotions(ctx, state);
  state.broadcasts = buildBroadcasts(ctx, state);
  state.tickets = buildTickets(ctx, state);
  state.sos = buildSos(ctx, state);
  const lowRated = requests.filter((request) => request.rating !== undefined && request.rating <= 2);
  for (const request of rng.sample(lowRated, Math.min(3, lowRated.length))) {
    state.reviewNotes[`rv-${request.id}`] = "Prestador contactado e advertido.";
  }
  state.audit = buildAudit(ctx, state);
  return state;
}
