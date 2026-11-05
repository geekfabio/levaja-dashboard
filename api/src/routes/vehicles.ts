import { and, eq, isNotNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providers } from "../db/schema/ops";
import { authenticate } from "../lib/authenticate";
import { listEnvelope } from "../lib/envelope";
import { haversineKm } from "../lib/geo";

const nearbyQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius_km: z.coerce.number().positive().default(5),
});

type NearbyVehicleType = "tow" | "cargo" | "move";

function inferVehicleType(coverageServiceTypes: string[]): NearbyVehicleType {
  if (coverageServiceTypes.includes("tow")) return "tow";
  if (coverageServiceTypes.includes("cargo")) return "cargo";
  return "move";
}

export async function vehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles/nearby", { preHandler: authenticate }, async (request) => {
    const { lat, lng, radius_km } = nearbyQuerySchema.parse(request.query);

    const rows = await db
      .select()
      .from(providers)
      .where(and(eq(providers.online, true), isNotNull(providers.lat), isNotNull(providers.lng)));

    const nearby = rows
      .map((provider) => ({
        id: provider.accountId,
        lat: Number(provider.lat),
        lng: Number(provider.lng),
        type: inferVehicleType(provider.coverageServiceTypes),
      }))
      .filter((vehicle) => haversineKm({ lat, lng }, { lat: vehicle.lat, lng: vehicle.lng }) <= radius_km);

    return listEnvelope(nearby);
  });
}
