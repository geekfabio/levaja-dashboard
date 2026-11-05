import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { clientAddresses, clientPaymentMethods } from "../db/schema/ops";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import type { AuthenticatedAccount } from "../lib/authenticate";
import { authenticate } from "../lib/authenticate";

const placeSchema = z.object({
  id: z.string(),
  label: z.string(),
  district: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
});

const addressBodySchema = z.object({
  label: z.string().min(1),
  icon: z.enum(["home", "work", "pin"]),
  place: placeSchema,
});

const paymentMethodBodySchema = z.object({
  type: z.literal("card"),
  last4: z.string().regex(/^\d{4}$/, "last4 tem de ter 4 dígitos."),
});

const defaultPaymentBodySchema = z.object({
  payment_method_id: z.string().min(1),
});

function requireSelf(account: AuthenticatedAccount, id: string) {
  if (account.id !== id) {
    throw apiError("forbidden", "Só o próprio cliente pode aceder a este recurso.");
  }
}

function presentAddress(row: typeof clientAddresses.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    place: row.place,
  };
}

function presentPaymentMethod(row: typeof clientPaymentMethods.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail,
    is_default: row.isDefault,
  };
}

async function listPaymentMethods(clientAccountId: string) {
  const rows = await db
    .select()
    .from(clientPaymentMethods)
    .where(eq(clientPaymentMethods.clientAccountId, clientAccountId));
  return rows.map(presentPaymentMethod);
}

export async function accountsRoutes(app: FastifyInstance) {
  app.get("/clients/:id/addresses", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);

    const rows = await db.select().from(clientAddresses).where(eq(clientAddresses.clientAccountId, id));
    reply.send(listEnvelope(rows.map(presentAddress)));
  });

  app.post("/clients/:id/addresses", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = addressBodySchema.parse(request.body);

    const [row] = await db
      .insert(clientAddresses)
      .values({
        id: newId("addr"),
        clientAccountId: id,
        label: body.label,
        icon: body.icon,
        place: body.place,
      })
      .returning();

    reply.status(201).send(dataEnvelope(presentAddress(row!)));
  });

  app.delete("/clients/:id/addresses/:addressId", { preHandler: authenticate }, async (request, reply) => {
    const { id, addressId } = request.params as { id: string; addressId: string };
    requireSelf(request.account!, id);

    const [existing] = await db
      .select()
      .from(clientAddresses)
      .where(and(eq(clientAddresses.id, addressId), eq(clientAddresses.clientAccountId, id)))
      .limit(1);
    if (!existing) {
      throw apiError("not_found", "Morada não encontrada.");
    }

    await db.delete(clientAddresses).where(eq(clientAddresses.id, addressId));
    reply.status(204).send();
  });

  app.get("/clients/:id/payment-methods", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);

    reply.send(listEnvelope(await listPaymentMethods(id)));
  });

  app.post("/clients/:id/payment-methods", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = paymentMethodBodySchema.parse(request.body);

    const existingCount = await db
      .select()
      .from(clientPaymentMethods)
      .where(eq(clientPaymentMethods.clientAccountId, id));

    const [row] = await db
      .insert(clientPaymentMethods)
      .values({
        id: newId("pm"),
        clientAccountId: id,
        type: body.type,
        title: "Cartão",
        detail: `•••• ${body.last4}`,
        isDefault: existingCount.length === 0,
      })
      .returning();

    reply.status(201).send(dataEnvelope(presentPaymentMethod(row!)));
  });

  app.put("/clients/:id/payment-methods/default", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    requireSelf(request.account!, id);
    const body = defaultPaymentBodySchema.parse(request.body);

    const [target] = await db
      .select()
      .from(clientPaymentMethods)
      .where(and(eq(clientPaymentMethods.id, body.payment_method_id), eq(clientPaymentMethods.clientAccountId, id)))
      .limit(1);
    if (!target) {
      throw apiError("not_found", "Método de pagamento não encontrado.");
    }

    if (!target.isDefault) {
      await db.batch([
        db
          .update(clientPaymentMethods)
          .set({ isDefault: false })
          .where(and(eq(clientPaymentMethods.clientAccountId, id), eq(clientPaymentMethods.isDefault, true))),
        db
          .update(clientPaymentMethods)
          .set({ isDefault: true })
          .where(eq(clientPaymentMethods.id, body.payment_method_id)),
      ]);
    }

    reply.send(listEnvelope(await listPaymentMethods(id)));
  });
}
