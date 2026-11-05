import { and, asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providerDocuments, providers, serviceRequests, vehicles, wallets, walletTransactions, zones } from "../db/schema/ops";
import { findAccountById } from "../lib/account";
import { authenticate } from "../lib/authenticate";
import type { AuthenticatedAccount } from "../lib/authenticate";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { estimateDistanceKm } from "../lib/geo";
import { newId } from "../lib/ids";
import { buildProviderDto, presentServiceRequest } from "../lib/request-presenter";

const vehicleClassEnum = z.enum(["tow_truck", "tuk_tuk", "pickup", "van", "truck"]);
const serviceTypeEnum = z.enum(["tow", "cargo", "small_move", "house_move"]);

const availabilityBodySchema = z.object({ online: z.boolean() });

const vehiclePatchBodySchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  plate: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  class: vehicleClassEnum.optional(),
  category_label: z.string().min(1).optional(),
  capacity_kg: z.number().int().positive().nullable().optional(),
  year: z.number().int().optional(),
});

const coverageBodySchema = z.object({
  zone_ids: z.array(z.string().min(1)).min(1, "Escolhe pelo menos uma zona."),
  service_types: z.array(serviceTypeEnum).min(1, "Escolhe pelo menos um tipo de serviço."),
});

const documentBodySchema = z.object({
  title: z.string().min(1).optional(),
  kind: z.string().min(1).optional(),
  file_url: z.string().url().nullable().optional(),
  valid_until: z.string().nullable().optional(),
});

const declinedBodySchema = z.object({ request_id: z.string().min(1) });

const withdrawalBodySchema = z.object({ amount_kz: z.number().int().positive() });

const VEHICLE_REQUIRED_KEYS = ["brand", "model", "plate", "color", "class", "category_label"] as const;

function requireSelf(account: AuthenticatedAccount, id: string) {
  if (account.id !== id) {
    throw apiError("forbidden", "Só o próprio prestador pode aceder a este recurso.");
  }
}

async function loadProviderOrNotFound(id: string) {
  const [row] = await db.select().from(providers).where(eq(providers.accountId, id)).limit(1);
  if (!row) throw apiError("not_found", "Prestador não encontrado.");
  return row;
}

function presentVehicle(row: typeof vehicles.$inferSelect) {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    plate: row.plate,
    color: row.color,
    class: row.vehicleClass,
    category_label: row.categoryLabel,
    capacity_kg: row.capacityKg,
    year: row.year,
  };
}

function presentDocument(row: typeof providerDocuments.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    file_url: row.fileUrl,
    valid_until: row.validUntil ? row.validUntil.toISOString() : null,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

function presentTransaction(row: typeof walletTransactions.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    amount_kz: row.amountKz,
    status: row.status,
    service_type: row.serviceType,
    request_id: row.requestId,
    created_at: row.createdAt.toISOString(),
  };
}

function presentZone(row: typeof zones.$inferSelect) {
  return { id: row.id, name: row.name, lat: Number(row.lat), lng: Number(row.lng), radius_km: Number(row.radiusKm) };
}

function dayKeyUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function loadEarnings(providerAccountId: string) {
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(and(eq(walletTransactions.providerAccountId, providerAccountId), eq(walletTransactions.type, "earning"), eq(walletTransactions.status, "completed")));

  const now = new Date();
  const todayKey = dayKeyUTC(now);
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    dayKeys.push(dayKeyUTC(day));
  }

  const sumsByDay = new Map(dayKeys.map((key) => [key, 0]));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  let todayKz = 0;
  let todayCount = 0;
  let weekKz = 0;

  for (const tx of transactions) {
    const key = dayKeyUTC(tx.createdAt);
    if (sumsByDay.has(key)) {
      sumsByDay.set(key, (sumsByDay.get(key) ?? 0) + tx.amountKz);
    }
    if (key === todayKey) {
      todayKz += tx.amountKz;
      todayCount += 1;
    }
    if (tx.createdAt.getTime() >= weekAgo) {
      weekKz += tx.amountKz;
    }
  }

  const completedRequests = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.providerAccountId, providerAccountId), eq(serviceRequests.status, "delivered")));
  const paidRequests = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.providerAccountId, providerAccountId), eq(serviceRequests.status, "paid")));
  const ratedRequests = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.providerAccountId, providerAccountId), eq(serviceRequests.status, "rated")));

  return {
    today_kz: todayKz,
    today_count: todayCount,
    week_kz: weekKz,
    completed_count: completedRequests.length + paidRequests.length + ratedRequests.length,
    last_7_days_kz: dayKeys.map((key) => sumsByDay.get(key) ?? 0),
  };
}

export async function providerRoutes(app: FastifyInstance) {
  app.get("/providers/:id/state", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const provider = await loadProviderOrNotFound(id);

    const profile = await buildProviderDto(id);
    if (!profile) throw apiError("not_found", "Prestador não encontrado.");

    const documentsRows = await db
      .select()
      .from(providerDocuments)
      .where(eq(providerDocuments.providerAccountId, id))
      .orderBy(desc(providerDocuments.createdAt));

    const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, id)).limit(1);
    const transactionsRows = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.providerAccountId, id))
      .orderBy(desc(walletTransactions.createdAt));

    reply.send(
      dataEnvelope({
        profile,
        online: provider.online,
        coverage: { zone_ids: provider.coverageZoneIds, service_types: provider.coverageServiceTypes },
        documents: documentsRows.map(presentDocument),
        wallet: {
          balance_kz: wallet?.balanceKz ?? 0,
          transactions: transactionsRows.map(presentTransaction),
          payout_account: wallet?.payoutAccount ?? null,
        },
        declined_request_ids: provider.declinedRequestIds,
      }),
    );
  });

  app.get("/providers/:id/nearby-requests", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const provider = await loadProviderOrNotFound(id);

    const searchingRows = await db.select().from(serviceRequests).where(eq(serviceRequests.status, "searching"));

    const matches = searchingRows.filter(
      (row) => provider.coverageServiceTypes.includes(row.serviceType) && !provider.declinedRequestIds.includes(row.id),
    );

    const providerPoint =
      provider.lat !== null && provider.lng !== null ? { lat: Number(provider.lat), lng: Number(provider.lng) } : null;

    const results = await Promise.all(
      matches.map(async (row) => {
        const pickup = row.pickup as { lat: number; lng: number };
        const distanceKm = estimateDistanceKm(providerPoint ?? pickup, pickup);
        return { request: await presentServiceRequest(row), distance_km: distanceKm };
      }),
    );

    results.sort((a, b) => a.distance_km - b.distance_km);
    reply.send(listEnvelope(results));
  });

  app.put("/providers/:id/availability", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = availabilityBodySchema.parse(request.body);
    await loadProviderOrNotFound(id);
    await db.update(providers).set({ online: body.online }).where(eq(providers.accountId, id));
    reply.status(204).send();
  });

  app.patch("/providers/:id/vehicle", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = vehiclePatchBodySchema.parse(request.body);
    await loadProviderOrNotFound(id);

    const [existing] = await db.select().from(vehicles).where(eq(vehicles.providerAccountId, id)).limit(1);

    if (!existing) {
      const missing = VEHICLE_REQUIRED_KEYS.filter((key) => body[key] === undefined);
      if (missing.length > 0) {
        throw apiError("validation", "Indica todos os dados da viatura na primeira vez.", { missing });
      }
      await db.insert(vehicles).values({
        id: newId("veh"),
        providerAccountId: id,
        brand: body.brand!,
        model: body.model!,
        plate: body.plate!,
        color: body.color!,
        vehicleClass: body.class!,
        categoryLabel: body.category_label!,
        capacityKg: body.capacity_kg ?? null,
        year: body.year ?? null,
      });
    } else {
      const patch: Partial<typeof vehicles.$inferInsert> = {};
      if (body.brand !== undefined) patch.brand = body.brand;
      if (body.model !== undefined) patch.model = body.model;
      if (body.plate !== undefined) patch.plate = body.plate;
      if (body.color !== undefined) patch.color = body.color;
      if (body.class !== undefined) patch.vehicleClass = body.class;
      if (body.category_label !== undefined) patch.categoryLabel = body.category_label;
      if (body.capacity_kg !== undefined) patch.capacityKg = body.capacity_kg;
      if (body.year !== undefined) patch.year = body.year;
      if (Object.keys(patch).length > 0) {
        await db.update(vehicles).set(patch).where(eq(vehicles.providerAccountId, id));
      }
    }

    const [row] = await db.select().from(vehicles).where(eq(vehicles.providerAccountId, id)).limit(1);
    reply.send(dataEnvelope(presentVehicle(row!)));
  });

  app.get("/zones", async (_request, reply) => {
    const rows = await db.select().from(zones).orderBy(asc(zones.name));
    reply.send(listEnvelope(rows.map(presentZone)));
  });

  app.put("/providers/:id/coverage", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = coverageBodySchema.parse(request.body);
    await loadProviderOrNotFound(id);
    await db
      .update(providers)
      .set({ coverageZoneIds: body.zone_ids, coverageServiceTypes: body.service_types })
      .where(eq(providers.accountId, id));
    reply.send(dataEnvelope({ zone_ids: body.zone_ids, service_types: body.service_types }));
  });

  app.post("/providers/:id/documents/:documentId", { preHandler: authenticate }, async (request, reply) => {
    const { id, documentId } = request.params as { id: string; documentId: string };
    requireSelf(request.account!, id);
    const body = documentBodySchema.parse(request.body ?? {});
    await loadProviderOrNotFound(id);

    const [existing] = await db
      .select()
      .from(providerDocuments)
      .where(and(eq(providerDocuments.id, documentId), eq(providerDocuments.providerAccountId, id)))
      .limit(1);

    if (!existing) {
      if (!body.title || !body.kind) {
        throw apiError("validation", "Indica title e kind para criar o documento.");
      }
      await db.insert(providerDocuments).values({
        id: documentId,
        providerAccountId: id,
        title: body.title,
        kind: body.kind,
        fileUrl: body.file_url ?? null,
        validUntil: body.valid_until ? new Date(body.valid_until) : null,
        status: "pending",
      });
    } else {
      await db
        .update(providerDocuments)
        .set({
          title: body.title ?? existing.title,
          kind: body.kind ?? existing.kind,
          fileUrl: body.file_url !== undefined ? body.file_url : existing.fileUrl,
          validUntil: body.valid_until !== undefined ? (body.valid_until ? new Date(body.valid_until) : null) : existing.validUntil,
          status: "pending",
        })
        .where(eq(providerDocuments.id, documentId));
    }

    const [row] = await db.select().from(providerDocuments).where(eq(providerDocuments.id, documentId)).limit(1);
    reply.send(dataEnvelope(presentDocument(row!)));
  });

  app.post("/providers/:id/declined", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = declinedBodySchema.parse(request.body);
    const provider = await loadProviderOrNotFound(id);

    if (!provider.declinedRequestIds.includes(body.request_id)) {
      await db
        .update(providers)
        .set({ declinedRequestIds: [...provider.declinedRequestIds, body.request_id] })
        .where(eq(providers.accountId, id));
    }

    reply.status(204).send();
  });

  app.post("/providers/:id/withdrawals", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = withdrawalBodySchema.parse(request.body);
    await loadProviderOrNotFound(id);

    const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, id)).limit(1);
    const balance = wallet?.balanceKz ?? 0;
    if (body.amount_kz > balance) {
      throw apiError("validation", "O valor é superior ao saldo disponível.");
    }

    const [transaction] = await db
      .insert(walletTransactions)
      .values({
        id: newId("tx"),
        providerAccountId: id,
        type: "withdrawal",
        title: "Levantamento para conta bancária",
        amountKz: -body.amount_kz,
        status: "pending",
      })
      .returning();

    reply.status(201).send(dataEnvelope(presentTransaction(transaction!)));
  });

  app.get("/providers/:id/earnings", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    await loadProviderOrNotFound(id);
    reply.send(dataEnvelope(await loadEarnings(id)));
  });

  app.get("/providers/:id/reviews", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    await loadProviderOrNotFound(id);

    const rows = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.providerAccountId, id))
      .orderBy(desc(serviceRequests.updatedAt));
    const rated = rows.filter((row) => row.rating !== null && row.review !== null);

    const data = await Promise.all(
      rated.map(async (row) => {
        const client = await findAccountById(row.clientAccountId);
        return {
          id: `review_${row.id}`,
          request_id: row.id,
          author_name: client?.fullName ?? "Cliente",
          rating: row.rating!,
          comment: row.review!,
          created_at: row.updatedAt.toISOString(),
        };
      }),
    );

    reply.send(listEnvelope(data));
  });
}
