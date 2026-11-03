import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { providerApplications } from "../db/schema/ops";
import { presentApplication } from "../lib/application-presenter";
import { dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { formatAngolaPhone } from "../lib/phone";

const serviceTypeEnum = z.enum(["tow", "cargo", "small_move", "house_move"]);
const vehicleClassEnum = z.enum(["tow_truck", "tuk_tuk", "pickup", "van", "truck"]);

const vehicleSchema = z.object({
  brand: z.string().trim().min(1),
  model: z.string().trim().min(1),
  plate: z.string().trim().min(1),
  color: z.string().trim().min(1),
  class: vehicleClassEnum,
  category_label: z.string().trim().min(1),
  capacity_kg: z.number().int().positive().nullable().optional(),
  year: z.number().int().optional(),
});

const applicationBodySchema = z.object({
  full_name: z.string().trim().min(3, "Indica o nome completo."),
  email: z.string().trim().min(1).email(),
  phone: z.string().trim().min(1),
  service_types: z.array(serviceTypeEnum).min(1, "Escolhe pelo menos um tipo de serviço."),
  zone_ids: z.array(z.string().min(1)).min(1, "Escolhe pelo menos uma zona."),
  vehicle: vehicleSchema.nullable().optional(),
});

export async function applicationRoutes(app: FastifyInstance) {
  app.post("/applications", async (request, reply) => {
    const body = applicationBodySchema.parse(request.body);

    const id = newId("appl");
    const [row] = await db
      .insert(providerApplications)
      .values({
        id,
        fullName: body.full_name,
        email: body.email.toLowerCase(),
        phone: formatAngolaPhone(body.phone),
        serviceTypes: body.service_types,
        zoneIds: body.zone_ids,
        vehicle: body.vehicle ?? null,
        status: "pending",
      })
      .returning();

    reply.status(201).send(dataEnvelope(presentApplication(row!)));
  });
}
