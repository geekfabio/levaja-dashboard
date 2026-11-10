import { and, asc, desc, eq, gt, inArray, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providers, requestNegotiations, serviceRequests } from "../db/schema/ops";
import { authenticate } from "../lib/authenticate";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { estimateDistanceKm, estimateDurationMin } from "../lib/geo";
import { newId } from "../lib/ids";
import { NEGOTIATION_STEP_KZ, clampAmount, negotiationBounds } from "../lib/negotiation";
import type { PriceBreakdown } from "../lib/pricing";
import { estimatePrice, providerEarningFor } from "../lib/pricing";
import { presentServiceRequest } from "../lib/request-presenter";
import { recordRequestEvent } from "../lib/request-events";
import { SERVICE_REQUEST_STATUS_FLOW, TRANSITION_ACTOR, canTransition, isCancellable } from "../lib/request-state";
import { creditEarning } from "../lib/wallet";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;

const REQUEST_STATUS_VALUES = [...SERVICE_REQUEST_STATUS_FLOW, "cancelled"] as const;
const requestStatusSchema = z.enum(REQUEST_STATUS_VALUES);

const placeSchema = z.object({
  id: z.string(),
  label: z.string(),
  district: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
});

const photoSchema = z.object({ id: z.string(), url: z.string(), caption: z.string() });

const towDetailsSchema = z.object({
  incident: z.enum(["mechanical", "accident", "flat_tire", "battery", "no_fuel"]),
  brand: z.string(),
  model: z.string(),
  plate: z.string(),
  color: z.string(),
  can_move: z.boolean(),
});

const cargoDetailsSchema = z.object({
  cargo_type: z.enum(["boxes", "furniture", "appliances", "construction", "goods", "other"]),
  description: z.string(),
  weight_range: z.enum(["upto100", "101to300", "301to500", "over500"]),
  volume: z.enum(["small", "medium", "large"]),
  vehicle_class: z.enum(["tow_truck", "tuk_tuk", "pickup", "van", "truck"]),
  helper: z.boolean(),
});

const movingDetailsSchema = z.object({
  property_type: z.enum(["t0_t1", "t2", "t3", "t4_plus", "office"]).nullable(),
  rooms: z.number().int(),
  items: z.string(),
  helpers: z.number().int(),
  pickup_floor: z.number().int(),
  delivery_floor: z.number().int(),
  elevator: z.boolean(),
  disassembly: z.boolean(),
  when: z.enum(["now", "scheduled"]),
  date: z.string().nullable(),
  time: z.string().nullable(),
});

const createRequestBodySchema = z.object({
  service_type: z.enum(["tow", "cargo", "small_move", "house_move"]),
  client_id: z.string(),
  pickup: placeSchema,
  dropoff: placeSchema,
  stops: z.array(placeSchema).default([]),
  scheduled_for: z.string().nullable().default(null),
  tow_details: towDetailsSchema.nullable().default(null),
  cargo_details: cargoDetailsSchema.nullable().default(null),
  moving_details: movingDetailsSchema.nullable().default(null),
  photos: z.array(photoSchema).default([]),
  instructions: z.string().nullable().default(null),
  payment_method: z.enum(["bank_reference", "card", "cash"]).nullable().default(null),
});

const transitionsBodySchema = z.object({ to: requestStatusSchema, actor: z.enum(["client", "provider", "system"]) });
const acceptBodySchema = z.object({ provider_id: z.string() });
const cancelBodySchema = z.object({ reason: z.string().min(1, "Indica o motivo do cancelamento.") });
const proposalBodySchema = z.object({ provider_id: z.string(), amount_kz: z.number().positive(), reason: z.string().min(1) });
const proposalAnswerBodySchema = z.object({ accepted: z.boolean() });
const pickupPhotosBodySchema = z.object({ photos: z.array(photoSchema) });
const proofBodySchema = z.object({
  photos: z.array(photoSchema),
  signed_by: z.string().min(1),
  good_condition: z.boolean(),
  notes: z.string().nullable().default(null),
});
const ratingBodySchema = z.object({ rating: z.number().int().min(1).max(5), review: z.string().nullable().default(null) });
const negotiationStartBodySchema = z.object({ direction: z.enum(["up", "down"]) });
const negotiationAdjustBodySchema = z.object({ direction: z.enum(["up", "down"]) });

type ProposalValue = { amount_kz: number; reason: string; status: "sent" | "accepted" | "declined" };

async function loadRequestOrNotFound(id: string): Promise<ServiceRequestRow> {
  const [row] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Pedido não encontrado.");
  return row;
}

type NegotiationRow = typeof requestNegotiations.$inferSelect;

function presentNegotiation(row: NegotiationRow) {
  return {
    id: row.id,
    request_id: row.requestId,
    provider_id: row.providerAccountId,
    amount_kz: row.amountKz,
    min_kz: row.minKz,
    max_kz: row.maxKz,
    by: row.by,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function loadNegotiationOrNotFound(id: string): Promise<NegotiationRow> {
  const [row] = await db.select().from(requestNegotiations).where(eq(requestNegotiations.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Negociação não encontrada.");
  return row;
}

async function cancelOtherPendingNegotiations(requestId: string, exceptId?: string) {
  const pending = await db
    .select()
    .from(requestNegotiations)
    .where(and(eq(requestNegotiations.requestId, requestId), eq(requestNegotiations.status, "pending")));
  const toCancel = pending.filter((row) => row.id !== exceptId).map((row) => row.id);
  if (toCancel.length) {
    await db.update(requestNegotiations).set({ status: "cancelled", updatedAt: new Date() }).where(inArray(requestNegotiations.id, toCancel));
  }
}

/** Assigns the request to a provider at a negotiated amount (the service price, before the platform fee). */
async function assignAtNegotiatedAmount(row: ServiceRequestRow, providerAccountId: string, amountKz: number, actor: "client" | "provider") {
  const currentPricing = row.pricing as PriceBreakdown;
  const nextPricing: PriceBreakdown = {
    ...currentPricing,
    extras_kz: amountKz - currentPricing.base_kz - currentPricing.distance_kz,
    total_kz: amountKz + currentPricing.platform_fee_kz,
  };
  const providerEarningKz = await providerEarningFor(nextPricing);
  const now = new Date();

  await db
    .update(serviceRequests)
    .set({ status: "assigned", providerAccountId, pricing: nextPricing, providerEarningKz, updatedAt: now })
    .where(eq(serviceRequests.id, row.id));
  await recordRequestEvent(row.id, "assigned", actor, now);
}

async function generateRequestCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `AL-${10000 + Math.floor(Math.random() * 90000)}`;
    const [existing] = await db.select({ id: serviceRequests.id }).from(serviceRequests).where(eq(serviceRequests.code, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw apiError("server", "Não foi possível gerar o código do pedido.");
}

function canSeeRequest(account: { id: string; kind: string }, row: Pick<ServiceRequestRow, "clientAccountId" | "providerAccountId" | "status">) {
  if (row.clientAccountId === account.id) return true;
  if (account.kind !== "provider") return false;
  return row.providerAccountId === account.id || row.status === "searching";
}

export async function requestRoutes(app: FastifyInstance) {
  app.get("/requests", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    const query = z
      .object({ client_id: z.string().optional(), provider_id: z.string().optional(), status: z.string().optional() })
      .parse(request.query);

    if (query.client_id && query.client_id !== account.id) {
      throw apiError("forbidden", "client_id tem de ser o teu.");
    }
    if (query.provider_id && query.provider_id !== account.id) {
      throw apiError("forbidden", "provider_id tem de ser o teu.");
    }

    const filters = [];
    if (query.client_id) {
      filters.push(eq(serviceRequests.clientAccountId, query.client_id));
    } else if (query.provider_id) {
      filters.push(eq(serviceRequests.providerAccountId, query.provider_id));
    } else if (account.kind === "client") {
      filters.push(eq(serviceRequests.clientAccountId, account.id));
    } else if (account.kind === "provider") {
      filters.push(eq(serviceRequests.providerAccountId, account.id));
    } else {
      throw apiError("forbidden", "Indica client_id ou provider_id.");
    }

    if (query.status) {
      const statusList = requestStatusSchema.array().parse(
        query.status
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      if (statusList.length > 0) filters.push(inArray(serviceRequests.status, statusList));
    }

    const rows = await db
      .select()
      .from(serviceRequests)
      .where(and(...filters))
      .orderBy(desc(serviceRequests.createdAt));
    const data = await Promise.all(rows.map(presentServiceRequest));
    reply.send(listEnvelope(data));
  });

  app.get("/requests/changes", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    const query = z.object({ since: z.string().min(1).optional() }).parse(request.query);
    const now = new Date();

    if (!query.since) {
      reply.send({ data: [], meta: { cursor: now.toISOString() } });
      return;
    }

    const since = new Date(query.since);
    if (Number.isNaN(since.getTime())) {
      throw apiError("validation", "Parâmetro since inválido.");
    }

    const visibility =
      account.kind === "provider"
        ? or(
            eq(serviceRequests.clientAccountId, account.id),
            eq(serviceRequests.providerAccountId, account.id),
            eq(serviceRequests.status, "searching"),
          )
        : eq(serviceRequests.clientAccountId, account.id);

    const rows = await db
      .select()
      .from(serviceRequests)
      .where(and(gt(serviceRequests.updatedAt, since), visibility))
      .orderBy(asc(serviceRequests.updatedAt));
    const data = await Promise.all(rows.map(presentServiceRequest));
    reply.send({ data, meta: { cursor: now.toISOString() } });
  });

  app.get("/requests/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    if (!canSeeRequest(request.account!, row)) {
      throw apiError("forbidden", "Não tens acesso a este pedido.");
    }
    reply.send(dataEnvelope(await presentServiceRequest(row)));
  });

  app.post("/requests", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    const body = createRequestBodySchema.parse(request.body);

    if (account.kind !== "client" || account.id !== body.client_id) {
      throw apiError("forbidden", "client_id tem de ser o teu.");
    }

    const distanceKm = estimateDistanceKm(body.pickup, body.dropoff, body.stops);
    const durationMin = estimateDurationMin(distanceKm);
    const pricing = await estimatePrice({
      serviceType: body.service_type,
      distanceKm,
      tow: body.tow_details,
      cargo: body.cargo_details,
      moving: body.moving_details,
    });
    const providerEarningKz = await providerEarningFor(pricing);
    const code = await generateRequestCode();
    const id = newId("req");
    const now = new Date();

    await db.insert(serviceRequests).values({
      id,
      code,
      serviceType: body.service_type,
      status: "searching",
      clientAccountId: account.id,
      providerAccountId: null,
      pickup: body.pickup,
      dropoff: body.dropoff,
      stops: body.stops,
      distanceKm: distanceKm.toString(),
      durationMin,
      scheduledFor: body.scheduled_for ? new Date(body.scheduled_for) : null,
      towDetails: body.tow_details,
      cargoDetails: body.cargo_details,
      movingDetails: body.moving_details,
      photos: body.photos,
      pickupPhotos: [],
      instructions: body.instructions,
      pricing,
      providerEarningKz,
      proposal: null,
      paymentMethod: body.payment_method,
      createdAt: now,
      updatedAt: now,
    });
    await recordRequestEvent(id, "searching", "system", now);

    const row = await loadRequestOrNotFound(id);
    reply.status(201).send(dataEnvelope(await presentServiceRequest(row)));
  });

  app.post("/requests/:id/transitions", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = transitionsBodySchema.parse(request.body);
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    if (!canTransition(row.status, body.to)) {
      throw apiError("invalid_transition", `Não é possível passar de ${row.status} para ${body.to}.`);
    }

    if (body.actor === "system") {
      throw apiError("forbidden", "A transição 'system' não é aceite vinda de uma conta autenticada.");
    }

    const expectedActor = TRANSITION_ACTOR[body.to];
    if (expectedActor && expectedActor !== body.actor) {
      throw apiError("forbidden", "Esta acção pertence ao outro interveniente.");
    }
    if (body.actor === "client" && row.clientAccountId !== account.id) {
      throw apiError("forbidden", "Esta acção pertence ao cliente do pedido.");
    }
    if (body.actor === "provider" && row.providerAccountId !== account.id) {
      throw apiError("forbidden", "Esta acção pertence ao prestador atribuído.");
    }

    const now = new Date();
    await db.update(serviceRequests).set({ status: body.to, updatedAt: now }).where(eq(serviceRequests.id, id));
    await recordRequestEvent(id, body.to, body.actor, now);

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/accept", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = acceptBodySchema.parse(request.body);
    const account = request.account!;

    if (account.kind !== "provider" || account.id !== body.provider_id) {
      throw apiError("forbidden", "provider_id tem de ser o teu.");
    }

    const row = await loadRequestOrNotFound(id);
    if (row.status !== "searching") {
      throw apiError("invalid_transition", "Este pedido já não está disponível.");
    }

    const [provider] = await db.select().from(providers).where(eq(providers.accountId, body.provider_id)).limit(1);
    if (!provider?.online) {
      throw apiError("forbidden", "Fica disponível para aceitar pedidos.");
    }

    const now = new Date();
    await db
      .update(serviceRequests)
      .set({ status: "assigned", providerAccountId: body.provider_id, updatedAt: now })
      .where(eq(serviceRequests.id, id));
    await recordRequestEvent(id, "assigned", "provider", now);
    await cancelOtherPendingNegotiations(id);

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/cancel", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = cancelBodySchema.parse(request.body);
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    const isClient = row.clientAccountId === account.id;
    const isAssignedProvider = !!row.providerAccountId && row.providerAccountId === account.id;
    if (!isClient && !isAssignedProvider) {
      throw apiError("forbidden", "Não tens acesso a este pedido.");
    }

    if (!isCancellable(row.status)) {
      throw apiError("invalid_transition", "Já não é possível cancelar após a recolha.");
    }

    const now = new Date();
    await db
      .update(serviceRequests)
      .set({ status: "cancelled", cancelReason: body.reason, updatedAt: now })
      .where(eq(serviceRequests.id, id));
    await recordRequestEvent(id, "cancelled", isClient ? "client" : "provider", now);

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/proposal", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = proposalBodySchema.parse(request.body);
    const account = request.account!;

    if (account.kind !== "provider" || account.id !== body.provider_id) {
      throw apiError("forbidden", "provider_id tem de ser o teu.");
    }

    const row = await loadRequestOrNotFound(id);
    if (row.status !== "searching") {
      throw apiError("invalid_transition", "Este pedido já não aceita propostas.");
    }

    const proposal: ProposalValue = { amount_kz: body.amount_kz, reason: body.reason, status: "sent" };
    await db
      .update(serviceRequests)
      .set({ providerAccountId: body.provider_id, proposal, updatedAt: new Date() })
      .where(eq(serviceRequests.id, id));

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/proposal/answer", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = proposalAnswerBodySchema.parse(request.body);
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    if (row.clientAccountId !== account.id) {
      throw apiError("forbidden", "Só o cliente do pedido pode responder à proposta.");
    }

    const proposal = row.proposal as ProposalValue | null;
    if (!proposal || proposal.status !== "sent") {
      throw apiError("invalid_transition", "Não há proposta por responder.");
    }

    const now = new Date();

    if (!body.accepted) {
      await db
        .update(serviceRequests)
        .set({ providerAccountId: null, proposal: { ...proposal, status: "declined" }, updatedAt: now })
        .where(eq(serviceRequests.id, id));
      reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
      return;
    }

    const currentPricing = row.pricing as PriceBreakdown;
    const nextPricing: PriceBreakdown = {
      ...currentPricing,
      extras_kz: proposal.amount_kz - currentPricing.base_kz - currentPricing.distance_kz,
      total_kz: proposal.amount_kz + currentPricing.platform_fee_kz,
    };
    const providerEarningKz = await providerEarningFor(nextPricing);

    await db
      .update(serviceRequests)
      .set({
        status: "assigned",
        pricing: nextPricing,
        providerEarningKz,
        proposal: { ...proposal, status: "accepted" },
        updatedAt: now,
      })
      .where(eq(serviceRequests.id, id));
    await recordRequestEvent(id, "assigned", "client", now);
    await cancelOtherPendingNegotiations(id);

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.get("/requests/:id/negotiations", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    if (account.kind === "client") {
      if (row.clientAccountId !== account.id) throw apiError("forbidden", "Não tens acesso a este pedido.");
      const rows = await db.select().from(requestNegotiations).where(eq(requestNegotiations.requestId, id)).orderBy(desc(requestNegotiations.updatedAt));
      reply.send(listEnvelope(rows.map(presentNegotiation)));
      return;
    }

    const rows = await db
      .select()
      .from(requestNegotiations)
      .where(and(eq(requestNegotiations.requestId, id), eq(requestNegotiations.providerAccountId, account.id)))
      .orderBy(desc(requestNegotiations.updatedAt));
    reply.send(listEnvelope(rows.map(presentNegotiation)));
  });

  app.post("/requests/:id/negotiations", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = request.account!;
    const body = negotiationStartBodySchema.parse(request.body);

    if (account.kind !== "provider") {
      throw apiError("forbidden", "Só um prestador pode abrir uma negociação.");
    }

    const row = await loadRequestOrNotFound(id);
    if (row.status !== "searching") {
      throw apiError("invalid_transition", "Este pedido já não está disponível.");
    }

    const [provider] = await db.select().from(providers).where(eq(providers.accountId, account.id)).limit(1);
    if (!provider?.online) {
      throw apiError("forbidden", "Fica disponível para negociar pedidos.");
    }

    const [existing] = await db
      .select()
      .from(requestNegotiations)
      .where(and(eq(requestNegotiations.requestId, id), eq(requestNegotiations.providerAccountId, account.id), eq(requestNegotiations.status, "pending")))
      .limit(1);
    if (existing) {
      reply.send(dataEnvelope(presentNegotiation(existing)));
      return;
    }

    const currentPricing = row.pricing as PriceBreakdown;
    const baseAmountKz = currentPricing.total_kz - currentPricing.platform_fee_kz;
    const { minKz, maxKz } = negotiationBounds(baseAmountKz);
    const amountKz = clampAmount(baseAmountKz + (body.direction === "up" ? NEGOTIATION_STEP_KZ : -NEGOTIATION_STEP_KZ), minKz, maxKz);

    const [created] = await db
      .insert(requestNegotiations)
      .values({ id: newId("neg"), requestId: id, providerAccountId: account.id, amountKz, minKz, maxKz, by: "provider", status: "pending" })
      .returning();

    reply.status(201).send(dataEnvelope(presentNegotiation(created!)));
  });

  app.post("/requests/:id/negotiations/:negotiationId/adjust", { preHandler: authenticate }, async (request, reply) => {
    const { id, negotiationId } = request.params as { id: string; negotiationId: string };
    const account = request.account!;
    const body = negotiationAdjustBodySchema.parse(request.body);

    const row = await loadRequestOrNotFound(id);
    const negotiation = await loadNegotiationOrNotFound(negotiationId);
    if (negotiation.requestId !== id) throw apiError("not_found", "Negociação não encontrada.");
    if (negotiation.status !== "pending") throw apiError("invalid_transition", "Esta negociação já terminou.");
    if (row.status !== "searching") throw apiError("invalid_transition", "Este pedido já não está disponível.");

    const isClient = account.kind === "client" && row.clientAccountId === account.id;
    const isProvider = account.kind === "provider" && negotiation.providerAccountId === account.id;
    if (!isClient && !isProvider) throw apiError("forbidden", "Não tens acesso a esta negociação.");

    const delta = body.direction === "up" ? NEGOTIATION_STEP_KZ : -NEGOTIATION_STEP_KZ;
    const amountKz = clampAmount(negotiation.amountKz + delta, negotiation.minKz, negotiation.maxKz);

    const [updated] = await db
      .update(requestNegotiations)
      .set({ amountKz, by: isClient ? "client" : "provider", updatedAt: new Date() })
      .where(eq(requestNegotiations.id, negotiationId))
      .returning();

    reply.send(dataEnvelope(presentNegotiation(updated!)));
  });

  app.post("/requests/:id/negotiations/:negotiationId/accept", { preHandler: authenticate }, async (request, reply) => {
    const { id, negotiationId } = request.params as { id: string; negotiationId: string };
    const account = request.account!;

    const row = await loadRequestOrNotFound(id);
    const negotiation = await loadNegotiationOrNotFound(negotiationId);
    if (negotiation.requestId !== id) throw apiError("not_found", "Negociação não encontrada.");
    if (negotiation.status !== "pending") throw apiError("invalid_transition", "Esta negociação já terminou.");
    if (row.status !== "searching") throw apiError("invalid_transition", "Este pedido já não está disponível.");

    const isClient = account.kind === "client" && row.clientAccountId === account.id;
    const isProvider = account.kind === "provider" && negotiation.providerAccountId === account.id;
    if (!isClient && !isProvider) throw apiError("forbidden", "Não tens acesso a esta negociação.");
    if ((isClient && negotiation.by === "client") || (isProvider && negotiation.by === "provider")) {
      throw apiError("invalid_transition", "Não podes aceitar a tua própria proposta.");
    }

    const [provider] = await db.select().from(providers).where(eq(providers.accountId, negotiation.providerAccountId)).limit(1);
    if (!provider?.online) {
      throw apiError("forbidden", "O prestador já não está disponível.");
    }

    await assignAtNegotiatedAmount(row, negotiation.providerAccountId, negotiation.amountKz, isClient ? "client" : "provider");
    await db.update(requestNegotiations).set({ status: "accepted", updatedAt: new Date() }).where(eq(requestNegotiations.id, negotiationId));
    await cancelOtherPendingNegotiations(id, negotiationId);

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/negotiations/:negotiationId/decline", { preHandler: authenticate }, async (request, reply) => {
    const { id, negotiationId } = request.params as { id: string; negotiationId: string };
    const account = request.account!;

    const row = await loadRequestOrNotFound(id);
    const negotiation = await loadNegotiationOrNotFound(negotiationId);
    if (negotiation.requestId !== id) throw apiError("not_found", "Negociação não encontrada.");
    if (negotiation.status !== "pending") throw apiError("invalid_transition", "Esta negociação já terminou.");

    const isClient = account.kind === "client" && row.clientAccountId === account.id;
    const isProvider = account.kind === "provider" && negotiation.providerAccountId === account.id;
    if (!isClient && !isProvider) throw apiError("forbidden", "Não tens acesso a esta negociação.");

    const [updated] = await db
      .update(requestNegotiations)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(requestNegotiations.id, negotiationId))
      .returning();

    reply.send(dataEnvelope(presentNegotiation(updated!)));
  });

  app.post("/requests/:id/pickup-photos", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = pickupPhotosBodySchema.parse(request.body);
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    if (!row.providerAccountId || row.providerAccountId !== account.id) {
      throw apiError("forbidden", "Só o prestador atribuído pode enviar estas fotos.");
    }

    await db.update(serviceRequests).set({ pickupPhotos: body.photos, updatedAt: new Date() }).where(eq(serviceRequests.id, id));

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/proof", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = proofBodySchema.parse(request.body);
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    if (!row.providerAccountId || row.providerAccountId !== account.id) {
      throw apiError("forbidden", "Só o prestador atribuído pode confirmar a entrega.");
    }
    if (row.status !== "in_transit") {
      throw apiError("invalid_transition", "O comprovativo só se regista durante o transporte.");
    }

    const now = new Date();
    const proof = {
      photos: body.photos,
      signed_by: body.signed_by,
      good_condition: body.good_condition,
      notes: body.notes,
      delivered_at: now.toISOString(),
    };

    await db.update(serviceRequests).set({ status: "delivered", proof, updatedAt: now }).where(eq(serviceRequests.id, id));
    await recordRequestEvent(id, "delivered", "provider", now);

    if (row.providerEarningKz !== null) {
      await creditEarning(row.providerAccountId, id, row.providerEarningKz);
    }

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });

  app.post("/requests/:id/rating", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ratingBodySchema.parse(request.body);
    const account = request.account!;
    const row = await loadRequestOrNotFound(id);

    if (row.clientAccountId !== account.id) {
      throw apiError("forbidden", "Só o cliente do pedido pode avaliar.");
    }
    if (row.status !== "paid") {
      throw apiError("invalid_transition", "Só é possível avaliar depois de pagar.");
    }

    const now = new Date();
    await db
      .update(serviceRequests)
      .set({ status: "rated", rating: body.rating, review: body.review, updatedAt: now })
      .where(eq(serviceRequests.id, id));
    await recordRequestEvent(id, "rated", "client", now);

    reply.send(dataEnvelope(await presentServiceRequest(await loadRequestOrNotFound(id))));
  });
}
