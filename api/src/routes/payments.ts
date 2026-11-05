import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { payments, serviceRequests } from "../db/schema/ops";
import { authenticate } from "../lib/authenticate";
import { apiError, dataEnvelope } from "../lib/envelope";
import { createBankReferencePayment, createConfirmedPayment, findPendingPayment, presentPayment } from "../lib/payments";
import { SERVICE_REQUEST_STATUS_FLOW } from "../lib/request-state";

const paymentMethodSchema = z.enum(["bank_reference", "card", "cash"]);
const createPaymentBodySchema = z.object({ payment_method: paymentMethodSchema });

function hasPassedDelivery(status: string) {
  const index = SERVICE_REQUEST_STATUS_FLOW.indexOf(status as (typeof SERVICE_REQUEST_STATUS_FLOW)[number]);
  return index >= SERVICE_REQUEST_STATUS_FLOW.indexOf("delivered");
}

export async function paymentRoutes(app: FastifyInstance) {
  app.post("/requests/:id/payments", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createPaymentBodySchema.parse(request.body);
    const account = request.account!;

    const [row] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
    if (!row) throw apiError("not_found", "Pedido não encontrado.");
    if (row.clientAccountId !== account.id) {
      throw apiError("forbidden", "Só o cliente do pedido pode pagar.");
    }
    if (!hasPassedDelivery(row.status)) {
      throw apiError("invalid_transition", "O pagamento só é possível depois da entrega.");
    }

    const amountKz = row.pricing ? (row.pricing as { total_kz: number }).total_kz : 0;

    const pending = await findPendingPayment(id, body.payment_method);
    if (pending) {
      reply.status(201).send(dataEnvelope(presentPayment(pending)));
      return;
    }

    const payment =
      body.payment_method === "bank_reference"
        ? await createBankReferencePayment(id, amountKz)
        : await createConfirmedPayment(id, body.payment_method, amountKz);

    reply.status(201).send(dataEnvelope(presentPayment(payment)));
  });

  app.get("/payments/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = request.account!;

    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) throw apiError("not_found", "Pagamento não encontrado.");

    const [serviceRequest] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, payment.requestId)).limit(1);
    if (!serviceRequest || serviceRequest.clientAccountId !== account.id) {
      throw apiError("forbidden", "Só o cliente do pedido pode consultar este pagamento.");
    }

    reply.send(dataEnvelope(presentPayment(payment)));
  });
}
