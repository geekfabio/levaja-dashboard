import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { platformSettings } from "../db/schema/admin";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";
import { PRICING_SETTINGS_KEY, loadPricingConfig, type PricingConfig } from "../lib/pricing-config";

const ruleSchema = z.object({ kind: z.enum(["tow", "cargo", "small_move", "house_move"]), base: z.number().nonnegative(), per_km: z.number().nonnegative() });
const extraSchema = z.object({ id: z.string(), label: z.string(), amount: z.number(), kinds: z.array(z.enum(["tow", "cargo", "small_move", "house_move"])) });

const pricingUpdateSchema = z.object({
  rules: z.array(ruleSchema).min(1),
  extras: z.array(extraSchema),
  platform_fee: z.number().nonnegative(),
  commission_rate: z.number().min(0).max(1),
  round_to: z.number().positive(),
  driver_bonus_kz: z.number().int().nonnegative().optional(),
  referral_invitee_discount_kz: z.number().int().nonnegative().optional(),
  referral_inviter_discount_kz: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
});

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function adminPricingRoutes(app: FastifyInstance) {
  app.get("/admin/pricing", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "pricing.view");
    return dataEnvelope(await loadPricingConfig());
  });

  app.put("/admin/pricing", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "pricing.edit");
    const body = pricingUpdateSchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da alteração");

    const kinds = body.rules.map((rule) => rule.kind);
    if (new Set(kinds).size !== kinds.length) {
      throw apiError("validation", "Cada serviço só pode ter uma regra de preço.");
    }

    const current = await loadPricingConfig();
    const next: PricingConfig = {
      rules: body.rules,
      extras: body.extras,
      platform_fee: body.platform_fee,
      commission_rate: body.commission_rate,
      round_to: body.round_to,
      driver_bonus_kz: body.driver_bonus_kz ?? current.driver_bonus_kz,
      referral_invitee_discount_kz: body.referral_invitee_discount_kz ?? current.referral_invitee_discount_kz,
      referral_inviter_discount_kz: body.referral_inviter_discount_kz ?? current.referral_inviter_discount_kz,
      updated_at: new Date().toISOString(),
      updated_by: admin.fullName,
    };

    const changes: { field: string; from: string; to: string }[] = [];
    if (current.platform_fee !== next.platform_fee) changes.push({ field: "Taxa da plataforma", from: String(current.platform_fee), to: String(next.platform_fee) });
    if (current.commission_rate !== next.commission_rate) changes.push({ field: "Comissão", from: String(current.commission_rate), to: String(next.commission_rate) });
    if (current.round_to !== next.round_to) changes.push({ field: "Arredondamento", from: String(current.round_to), to: String(next.round_to) });
    if (current.driver_bonus_kz !== next.driver_bonus_kz) changes.push({ field: "Bónus por corrida", from: String(current.driver_bonus_kz), to: String(next.driver_bonus_kz) });
    if (current.referral_invitee_discount_kz !== next.referral_invitee_discount_kz) {
      changes.push({ field: "Desconto do convidado", from: String(current.referral_invitee_discount_kz), to: String(next.referral_invitee_discount_kz) });
    }
    if (current.referral_inviter_discount_kz !== next.referral_inviter_discount_kz) {
      changes.push({ field: "Desconto de quem convida", from: String(current.referral_inviter_discount_kz), to: String(next.referral_inviter_discount_kz) });
    }
    if (stableStringify(current.rules) !== stableStringify(next.rules)) changes.push({ field: "Regras de preço", from: "—", to: "Actualizadas" });
    if (stableStringify(current.extras) !== stableStringify(next.extras)) changes.push({ field: "Extras", from: "—", to: "Actualizados" });
    if (!changes.length) throw apiError("validation", "Não há alterações para guardar.");

    await db
      .insert(platformSettings)
      .values({ key: PRICING_SETTINGS_KEY, value: next, updatedByAccountId: admin.id })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: next, updatedByAccountId: admin.id, updatedAt: new Date() } });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "pricing.update",
      targetModule: "pricing",
      targetId: "pricing",
      targetLabel: "Tabela de preços",
      reason,
      changes,
      sensitive: true,
    });

    return dataEnvelope(next);
  });
}
