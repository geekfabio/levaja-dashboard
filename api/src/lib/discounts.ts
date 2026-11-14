import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../db/client";
import { clients, serviceRequests, zones } from "../db/schema/ops";
import { promotionUses, promotions, referralRewards } from "../db/schema/promotions";
import { apiError } from "./envelope";
import { haversineKm, type GeoPoint } from "./geo";
import { newId } from "./ids";
import { loadPricingConfig } from "./pricing-config";

type PromotionRow = typeof promotions.$inferSelect;

/** Discounts are paid in cash, so they are kept to multiples of this. */
const DISCOUNT_STEP_KZ = 50;
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 8;
const SETTLED_STATUSES = ["paid", "rated"] as const;

export type AppliedDiscount =
  | { source: "promotion"; discountKz: number; label: string; promotionId: string }
  | { source: "referral"; discountKz: number; label: string; rewardId: string };

export type DiscountContext = { clientAccountId: string; serviceType: string; pickup: GeoPoint; totalKz: number };

function invalid(message: string): never {
  throw apiError("validation", message, { issues: [{ field: "promo_code", message }] });
}

async function liveRequestIds(requestIds: string[]) {
  if (requestIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(and(inArray(serviceRequests.id, requestIds), ne(serviceRequests.status, "cancelled")));
  return new Set(rows.map((row) => row.id));
}

async function isInsidePromotionZones(promotion: PromotionRow, pickup: GeoPoint) {
  if (promotion.zoneIds.length === 0) return true;
  const rows = await db.select().from(zones).where(inArray(zones.id, promotion.zoneIds));
  return rows.some((zone) => haversineKm(pickup, { lat: Number(zone.lat), lng: Number(zone.lng) }) <= Number(zone.radiusKm));
}

/** Validates a promotion code for this order and returns the discount it gives. Throws a validation error when it does not apply. */
export async function resolvePromotion(code: string, context: DiscountContext): Promise<AppliedDiscount> {
  const normalized = code.trim().toUpperCase();
  const [promotion] = await db.select().from(promotions).where(eq(promotions.code, normalized)).limit(1);
  if (!promotion) invalid("Código promocional inválido.");

  const now = Date.now();
  if (promotion.endedAt || promotion.endsAt.getTime() <= now) invalid("Esta promoção já terminou.");
  if (promotion.paused || promotion.startsAt.getTime() > now) invalid("Esta promoção não está activa.");
  if (promotion.services.length > 0 && !promotion.services.includes(context.serviceType)) invalid("Este código não se aplica a este serviço.");
  if (context.totalKz < promotion.minOrderKz) invalid(`Este código só se aplica a pedidos a partir de ${promotion.minOrderKz} Kz.`);
  if (!(await isInsidePromotionZones(promotion, context.pickup))) invalid("Este código não se aplica a esta zona.");

  // Uses on cancelled requests don't count: the discount was never given.
  const uses = await db.select().from(promotionUses).where(eq(promotionUses.promotionId, promotion.id));
  const live = await liveRequestIds(uses.map((use) => use.requestId));
  const liveUses = uses.filter((use) => live.has(use.requestId));

  if (liveUses.filter((use) => use.clientAccountId === context.clientAccountId).length >= promotion.perClientLimit) {
    invalid("Já usaste este código.");
  }
  if (promotion.firstOrderOnly) {
    const [previous] = await db
      .select({ id: serviceRequests.id })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.clientAccountId, context.clientAccountId), ne(serviceRequests.status, "cancelled")))
      .limit(1);
    if (previous) invalid("Este código é só para o primeiro pedido.");
  }

  const remainingBudgetKz = promotion.budgetKz - liveUses.reduce((sum, use) => sum + use.discountKz, 0);
  let discountKz = promotion.kind === "percent" ? (context.totalKz * promotion.value) / 100 : promotion.value;
  if (promotion.maxDiscountKz !== null) discountKz = Math.min(discountKz, promotion.maxDiscountKz);
  discountKz = Math.min(discountKz, remainingBudgetKz, context.totalKz);
  discountKz = Math.floor(discountKz / DISCOUNT_STEP_KZ) * DISCOUNT_STEP_KZ;
  if (discountKz <= 0) invalid("Esta promoção esgotou.");

  return { source: "promotion", discountKz, label: `Código ${promotion.code}`, promotionId: promotion.id };
}

/** The oldest invite discount the client has not spent yet, if any. */
export async function nextReferralDiscount(clientAccountId: string, totalKz: number): Promise<AppliedDiscount | null> {
  const [reward] = await db
    .select()
    .from(referralRewards)
    .where(and(eq(referralRewards.clientAccountId, clientAccountId), isNull(referralRewards.usedRequestId)))
    .orderBy(asc(referralRewards.createdAt))
    .limit(1);
  if (!reward) return null;
  const discountKz = Math.min(reward.amountKz, totalKz);
  if (discountKz <= 0) return null;
  return { source: "referral", discountKz, label: "Desconto de convite", rewardId: reward.id };
}

/** Ties the discount to the request that used it (promotion budget/limits, or the invite reward being spent). */
export async function recordDiscountUse(requestId: string, clientAccountId: string, discount: AppliedDiscount) {
  if (discount.source === "promotion") {
    await db.insert(promotionUses).values({ id: newId("puse"), promotionId: discount.promotionId, requestId, clientAccountId, discountKz: discount.discountKz });
    return;
  }
  await db.update(referralRewards).set({ usedRequestId: requestId }).where(eq(referralRewards.id, discount.rewardId));
}

/** A cancelled request gives its discount back: the promotion use is dropped and the invite reward can be spent again. */
export async function releaseDiscountUse(requestId: string) {
  await db.delete(promotionUses).where(eq(promotionUses.requestId, requestId));
  await db.update(referralRewards).set({ usedRequestId: null }).where(eq(referralRewards.usedRequestId, requestId));
}

function randomReferralCode() {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  return code;
}

/** Every client gets an invite code the first time it is needed. */
export async function ensureReferralCode(clientAccountId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.accountId, clientAccountId)).limit(1);
  if (!client) throw apiError("not_found", "Cliente não encontrado.");
  if (client.referralCode) return client.referralCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomReferralCode();
    const [taken] = await db.select({ id: clients.accountId }).from(clients).where(eq(clients.referralCode, candidate)).limit(1);
    if (taken) continue;
    await db.update(clients).set({ referralCode: candidate }).where(eq(clients.accountId, clientAccountId));
    return candidate;
  }
  throw apiError("server", "Não foi possível gerar o código de convite.");
}

export async function referralSummary(clientAccountId: string) {
  const config = await loadPricingConfig();
  const code = await ensureReferralCode(clientAccountId);
  const [client] = await db.select().from(clients).where(eq(clients.accountId, clientAccountId)).limit(1);
  const rewards = await db.select().from(referralRewards).where(eq(referralRewards.clientAccountId, clientAccountId)).orderBy(asc(referralRewards.createdAt));
  const invited = await db.select({ id: clients.accountId }).from(clients).where(eq(clients.referredByAccountId, clientAccountId));

  return {
    enabled: config.referral_invitee_discount_kz > 0 || config.referral_inviter_discount_kz > 0,
    code,
    invitee_discount_kz: config.referral_invitee_discount_kz,
    inviter_discount_kz: config.referral_inviter_discount_kz,
    redeemed: Boolean(client?.referredByAccountId),
    invited_count: invited.length,
    available_kz: rewards.filter((reward) => reward.usedRequestId === null).reduce((sum, reward) => sum + reward.amountKz, 0),
    rewards: rewards.map((reward) => ({ id: reward.id, kind: reward.kind, amount_kz: reward.amountKz, used: reward.usedRequestId !== null, created_at: reward.createdAt.toISOString() })),
  };
}

/** A new client enters a friend's code: they get a discount for their first ride, and the friend is rewarded once that ride is paid. */
export async function redeemReferralCode(clientAccountId: string, code: string) {
  const fail = (message: string): never => {
    throw apiError("validation", message, { issues: [{ field: "code", message }] });
  };
  const config = await loadPricingConfig();
  if (config.referral_invitee_discount_kz <= 0) fail("Os convites não estão activos de momento.");

  const [client] = await db.select().from(clients).where(eq(clients.accountId, clientAccountId)).limit(1);
  if (!client) throw apiError("not_found", "Cliente não encontrado.");
  if (client.referredByAccountId) fail("Já usaste um código de convite.");

  const [inviter] = await db.select().from(clients).where(eq(clients.referralCode, code.trim().toUpperCase())).limit(1);
  if (!inviter) fail("Código de convite inválido.");
  if (inviter!.accountId === clientAccountId) fail("Não podes usar o teu próprio código.");

  const [settled] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.clientAccountId, clientAccountId), inArray(serviceRequests.status, [...SETTLED_STATUSES])))
    .limit(1);
  if (settled) fail("O código de convite é só para quem ainda não fez nenhum pedido.");

  await db.update(clients).set({ referredByAccountId: inviter!.accountId }).where(eq(clients.accountId, clientAccountId));
  await db.insert(referralRewards).values({
    id: newId("rwd"),
    clientAccountId,
    kind: "invitee",
    sourceAccountId: inviter!.accountId,
    amountKz: config.referral_invitee_discount_kz,
  });
}

/** Called when a request is paid: the first paid ride of an invited client rewards whoever invited them (once). */
export async function rewardInviterFor(clientAccountId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.accountId, clientAccountId)).limit(1);
  if (!client?.referredByAccountId) return;

  const config = await loadPricingConfig();
  if (config.referral_inviter_discount_kz <= 0) return;

  const [already] = await db
    .select({ id: referralRewards.id })
    .from(referralRewards)
    .where(and(eq(referralRewards.clientAccountId, client.referredByAccountId), eq(referralRewards.kind, "inviter"), eq(referralRewards.sourceAccountId, clientAccountId)))
    .limit(1);
  if (already) return;

  const [inviter] = await db.select({ id: clients.accountId }).from(clients).where(eq(clients.accountId, client.referredByAccountId)).limit(1);
  if (!inviter) return;

  await db.insert(referralRewards).values({
    id: newId("rwd"),
    clientAccountId: client.referredByAccountId,
    kind: "inviter",
    sourceAccountId: clientAccountId,
    amountKz: config.referral_inviter_discount_kz,
  });
}
