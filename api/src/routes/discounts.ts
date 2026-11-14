import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/authenticate";
import { redeemReferralCode, referralSummary, resolvePromotion } from "../lib/discounts";
import { apiError, dataEnvelope } from "../lib/envelope";

const validateBodySchema = z.object({
  code: z.string().trim().min(1),
  service_type: z.enum(["tow", "cargo", "small_move", "house_move"]),
  pickup: z.object({ lat: z.number(), lng: z.number() }),
  total_kz: z.number().nonnegative(),
});

const redeemBodySchema = z.object({ code: z.string().trim().min(1) });

function requireClient(kind: string) {
  if (kind !== "client") throw apiError("forbidden", "Só os clientes usam códigos de desconto e convites.");
}

/** Promotion codes and invites, as the mobile app sees them. The discount itself is applied by POST /requests. */
export async function discountRoutes(app: FastifyInstance) {
  // Preview only: POST /requests validates the code again against the price the server computes.
  app.post("/promotions/validate", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    requireClient(account.kind);
    const body = validateBodySchema.parse(request.body);
    const discount = await resolvePromotion(body.code, { clientAccountId: account.id, serviceType: body.service_type, pickup: body.pickup, totalKz: body.total_kz });
    reply.send(dataEnvelope({ code: body.code.toUpperCase(), discount_kz: discount.discountKz, label: discount.label }));
  });

  app.get("/referrals/me", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    requireClient(account.kind);
    reply.send(dataEnvelope(await referralSummary(account.id)));
  });

  app.post("/referrals/redeem", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    requireClient(account.kind);
    const body = redeemBodySchema.parse(request.body);
    await redeemReferralCode(account.id, body.code);
    reply.send(dataEnvelope(await referralSummary(account.id)));
  });
}
