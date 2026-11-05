import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { zones } from "../db/schema/ops";
import { authenticate } from "../lib/authenticate";
import { dataEnvelope, listEnvelope } from "../lib/envelope";
import { reverseGeocode, searchPlaces } from "../lib/geocoding";
import type { PlaceLike } from "../lib/geocoding";

const LUANDA_CENTER: PlaceLike = {
  id: "luanda-centro",
  label: "Luanda",
  district: "Ingombota",
  city: "Luanda",
  lat: -8.8368,
  lng: 13.2343,
};

const coordsQuerySchema = z.object({ lat: z.coerce.number(), lng: z.coerce.number() });
const searchQuerySchema = z.object({ q: z.string().min(1) });

function presentZone(zone: typeof zones.$inferSelect): PlaceLike {
  return {
    id: zone.id,
    label: zone.name,
    district: zone.name,
    city: "Luanda",
    lat: Number(zone.lat),
    lng: Number(zone.lng),
  };
}

export async function locationRoutes(app: FastifyInstance) {
  app.get("/locations/current", { preHandler: authenticate }, async () => {
    return dataEnvelope(LUANDA_CENTER);
  });

  app.get("/locations/reverse", { preHandler: authenticate }, async (request) => {
    const { lat, lng } = coordsQuerySchema.parse(request.query);
    const place = await reverseGeocode(lat, lng);
    return dataEnvelope(place);
  });

  app.get("/locations/search", { preHandler: authenticate }, async (request) => {
    const { q } = searchQuerySchema.parse(request.query);
    const places = await searchPlaces(q);
    return listEnvelope(places);
  });

  app.get("/locations/areas", { preHandler: authenticate }, async () => {
    const rows = await db.select().from(zones);
    return listEnvelope(rows.map(presentZone));
  });
}
