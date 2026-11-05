import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { providers, serviceRequestEvents, serviceRequests, vehicles } from "../db/schema/ops";
import { findAccountById, toClientResponse } from "./account";

type ServiceRequestRow = typeof serviceRequests.$inferSelect;

async function buildClientDto(clientAccountId: string) {
  const account = await findAccountById(clientAccountId);
  if (!account) return null;
  return toClientResponse(account);
}

export async function buildProviderDto(providerAccountId: string) {
  const account = await findAccountById(providerAccountId);
  if (!account) return null;

  const [provider] = await db.select().from(providers).where(eq(providers.accountId, providerAccountId)).limit(1);
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.providerAccountId, providerAccountId)).limit(1);

  return {
    id: account.id,
    full_name: account.fullName,
    phone: account.phone ?? "",
    rating: provider?.rating !== null && provider?.rating !== undefined ? Number(provider.rating) : 5,
    reviews_count: provider?.reviewsCount ?? 0,
    verified: provider?.verified ?? false,
    avatar_url: provider?.avatarUrl ?? null,
    vehicle: vehicle
      ? {
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate,
          color: vehicle.color,
          class: vehicle.vehicleClass,
          category_label: vehicle.categoryLabel,
          capacity_kg: vehicle.capacityKg,
          year: vehicle.year,
        }
      : null,
    location: provider?.lat !== null && provider?.lng !== null && provider?.lat !== undefined && provider?.lng !== undefined
      ? { lat: Number(provider.lat), lng: Number(provider.lng) }
      : null,
  };
}

async function loadTimeline(requestId: string) {
  const events = await db
    .select()
    .from(serviceRequestEvents)
    .where(eq(serviceRequestEvents.requestId, requestId))
    .orderBy(asc(serviceRequestEvents.at));
  return events.map((event) => ({ status: event.status, at: event.at.toISOString() }));
}

export async function presentServiceRequest(row: ServiceRequestRow) {
  const [client, provider, timeline] = await Promise.all([
    buildClientDto(row.clientAccountId),
    row.providerAccountId ? buildProviderDto(row.providerAccountId) : Promise.resolve(null),
    loadTimeline(row.id),
  ]);

  return {
    id: row.id,
    code: row.code,
    service_type: row.serviceType,
    status: row.status,
    client_id: row.clientAccountId,
    provider_id: row.providerAccountId,
    client,
    provider,
    pickup: row.pickup,
    dropoff: row.dropoff,
    stops: row.stops,
    distance_km: row.distanceKm !== null ? Number(row.distanceKm) : null,
    duration_min: row.durationMin,
    created_at: row.createdAt.toISOString(),
    scheduled_for: row.scheduledFor ? row.scheduledFor.toISOString() : null,
    tow_details: row.towDetails,
    cargo_details: row.cargoDetails,
    moving_details: row.movingDetails,
    photos: row.photos,
    pickup_photos: row.pickupPhotos,
    instructions: row.instructions,
    pricing: row.pricing,
    provider_earning_kz: row.providerEarningKz,
    proposal: row.proposal,
    payment_method: row.paymentMethod,
    rating: row.rating,
    review: row.review,
    proof: row.proof,
    timeline,
    cancel_reason: row.cancelReason,
  };
}
