import { desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { serviceTypeEnum, serviceRequests } from "../db/schema/ops";
import { promotionKindEnum, promotionUses, promotions } from "../db/schema/promotions";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type PromotionRow = typeof promotions.$inferSelect;
type PromotionUseRow = typeof promotionUses.$inferSelect;

const SERVICE_KINDS = serviceTypeEnum.enumValues;
const PROMOTION_KINDS = promotionKindEnum.enumValues;
const PROMOTION_STATUSES = ["scheduled", "active", "paused", "ended", "exhausted"] as const;
type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

const listQuerySchema = pageQuerySchema.extend({ status: z.string().optional(), q: z.string().optional() });

const createBodySchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.enum(PROMOTION_KINDS),
  value: z.number().int(),
  max_discount_kz: z.number().int().positive().optional(),
  min_order_kz: z.number().int().nonnegative(),
  services: z.array(z.enum(SERVICE_KINDS)),
  zone_ids: z.array(z.string()),
  starts_at: z.string(),
  ends_at: z.string(),
  budget_kz: z.number().int(),
  per_client_limit: z.number().int(),
  first_order_only: z.boolean(),
});

const reasonBodySchema = z.object({ reason: z.string().optional() });

function promotionStatus(promotion: Pick<PromotionRow, "startsAt" | "endsAt" | "paused" | "endedAt" | "budgetKz">, spentKz: number, now: number): PromotionStatus {
  if (promotion.endedAt || promotion.endsAt.getTime() <= now) return "ended";
  if (spentKz >= promotion.budgetKz) return "exhausted";
  if (promotion.paused) return "paused";
  if (promotion.startsAt.getTime() > now) return "scheduled";
  return "active";
}

function label(promotion: PromotionRow) {
  return `${promotion.code} — ${promotion.name}`;
}

function matchesQuery(q: string | undefined, ...fields: string[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field.toLowerCase().includes(needle));
}

function validateCreateInput(body: z.infer<typeof createBodySchema>, existingCodes: string[]) {
  const issues: { field: string; message: string }[] = [];
  const code = body.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) issues.push({ field: "code", message: "O código tem 4 a 12 letras ou números, sem espaços." });
  else if (existingCodes.includes(code)) issues.push({ field: "code", message: "Já existe uma promoção com este código." });
  if (body.name.trim().length < 3) issues.push({ field: "name", message: "Indique o nome da promoção." });
  if (body.kind === "percent" && (body.value < 1 || body.value > 50)) issues.push({ field: "value", message: "A percentagem tem de estar entre 1 % e 50 %." });
  if (body.kind === "fixed" && body.value < 100) issues.push({ field: "value", message: "O desconto fixo tem de ser de pelo menos 100 Kz." });
  if (body.min_order_kz < 0) issues.push({ field: "min_order_kz", message: "O valor mínimo não pode ser negativo." });
  const startsAt = new Date(body.starts_at);
  const endsAt = new Date(body.ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
    issues.push({ field: "ends_at", message: "O fim tem de ser depois do início." });
  }
  if (body.budget_kz < 1000) issues.push({ field: "budget_kz", message: "O orçamento tem de ser de pelo menos 1 000 Kz." });
  if (body.per_client_limit < 1) issues.push({ field: "per_client_limit", message: "Cada cliente tem de poder usar pelo menos uma vez." });
  if (issues.length) throw apiError("validation", issues[0]!.message, { issues });
  return { code, startsAt, endsAt };
}

async function summary(promotion: PromotionRow, now: number) {
  const uses = await db.select().from(promotionUses).where(eq(promotionUses.promotionId, promotion.id));
  const spentKz = uses.reduce((sum, use) => sum + use.discountKz, 0);
  const requestIds = [...new Set(uses.map((use) => use.requestId))];
  const requestRows = requestIds.length ? await db.select().from(serviceRequests).where(inArray(serviceRequests.id, requestIds)) : [];
  const priceByRequest = new Map(requestRows.map((row) => [row.id, (row.pricing as { total_kz?: number } | null)?.total_kz ?? 0]));
  const volumeKz = uses.reduce((sum, use) => sum + (priceByRequest.get(use.requestId) ?? 0), 0);

  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    kind: promotion.kind,
    value: promotion.value,
    max_discount_kz: promotion.maxDiscountKz,
    min_order_kz: promotion.minOrderKz,
    services: promotion.services,
    zone_ids: promotion.zoneIds,
    starts_at: promotion.startsAt.toISOString(),
    ends_at: promotion.endsAt.toISOString(),
    budget_kz: promotion.budgetKz,
    per_client_limit: promotion.perClientLimit,
    first_order_only: promotion.firstOrderOnly,
    paused: promotion.paused,
    ended_at: promotion.endedAt ? promotion.endedAt.toISOString() : null,
    created_at: promotion.createdAt.toISOString(),
    created_by_account_id: promotion.createdByAccountId,
    status: promotionStatus(promotion, spentKz, now),
    spent_kz: spentKz,
    uses_count: uses.length,
    clients: new Set(uses.map((use) => use.clientAccountId)).size,
    volume_kz: volumeKz,
  };
}

async function loadPromotionOrNotFound(id: string): Promise<PromotionRow> {
  const [row] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Promoção não encontrada.");
  return row;
}

async function presentRecentUse(use: PromotionUseRow) {
  const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, use.requestId)).limit(1);
  const [client] = await db.select().from(accounts).where(eq(accounts.id, use.clientAccountId)).limit(1);
  return {
    request_id: use.requestId,
    client_id: use.clientAccountId,
    discount_kz: use.discountKz,
    at: use.at.toISOString(),
    request_code: request?.code ?? "—",
    client_name: client?.fullName ?? "Cliente",
  };
}

export async function adminPromotionsRoutes(app: FastifyInstance) {
  app.get("/admin/promotions", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "promotions.view");
    const query = listQuerySchema.parse(request.query);

    const statusFilter = csvList(query.status);
    if (statusFilter && !statusFilter.every((value) => (PROMOTION_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de promoção inválido.");
    }

    const now = Date.now();
    const rows = await db.select().from(promotions).orderBy(desc(promotions.startsAt));
    const presented = await Promise.all(rows.map((row) => summary(row, now)));
    const filtered = presented
      .filter((item) => !statusFilter?.length || statusFilter.includes(item.status))
      .filter((item) => matchesQuery(query.q, item.code, item.name));

    return listPageEnvelope(paginate(filtered, query));
  });

  app.get("/admin/promotions/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "promotions.view");
    const { id } = request.params as { id: string };
    const promotion = await loadPromotionOrNotFound(id);

    const uses = await db.select().from(promotionUses).where(eq(promotionUses.promotionId, id)).orderBy(desc(promotionUses.at)).limit(15);

    return dataEnvelope({
      ...(await summary(promotion, Date.now())),
      recent_uses: await Promise.all(uses.map(presentRecentUse)),
    });
  });

  app.post("/admin/promotions", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "promotions.manage");
    const body = createBodySchema.parse(request.body);

    const existing = await db.select({ code: promotions.code }).from(promotions);
    const { code, startsAt, endsAt } = validateCreateInput(body, existing.map((row) => row.code));

    const [promotion] = await db
      .insert(promotions)
      .values({
        id: newId("promo"),
        code,
        name: body.name.trim(),
        kind: body.kind,
        value: body.value,
        maxDiscountKz: body.max_discount_kz,
        minOrderKz: body.min_order_kz,
        services: body.services,
        zoneIds: body.zone_ids,
        startsAt,
        endsAt,
        budgetKz: body.budget_kz,
        perClientLimit: body.per_client_limit,
        firstOrderOnly: body.first_order_only,
        createdByAccountId: admin.id,
      })
      .returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "promotion.create",
      targetModule: "promotion",
      targetId: promotion!.id,
      targetLabel: label(promotion!),
      changes: [
        { field: "Desconto", from: "—", to: promotion!.kind === "percent" ? `${promotion!.value} %` : String(promotion!.value) },
        { field: "Orçamento", from: "—", to: String(promotion!.budgetKz) },
      ],
    });

    return dataEnvelope(await summary(promotion!, Date.now()));
  });

  app.post("/admin/promotions/:id/pause", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "promotions.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body ?? {});
    const reason = requireReason(body.reason, "o motivo");

    const promotion = await loadPromotionOrNotFound(id);
    const uses = await db.select().from(promotionUses).where(eq(promotionUses.promotionId, id));
    const spentKz = uses.reduce((sum, use) => sum + use.discountKz, 0);
    const status = promotionStatus(promotion, spentKz, Date.now());
    if (status !== "active" && status !== "scheduled") {
      throw apiError("invalid_transition", `Não é possível pausar uma promoção «${status}».`);
    }

    await db.update(promotions).set({ paused: true }).where(eq(promotions.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "promotion.pause",
      targetModule: "promotion",
      targetId: id,
      targetLabel: label(promotion),
      reason,
      changes: [{ field: "Estado", from: status, to: "paused" }],
    });

    return dataEnvelope(await summary(await loadPromotionOrNotFound(id), Date.now()));
  });

  app.post("/admin/promotions/:id/resume", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "promotions.manage");
    const { id } = request.params as { id: string };

    const promotion = await loadPromotionOrNotFound(id);
    const uses = await db.select().from(promotionUses).where(eq(promotionUses.promotionId, id));
    const spentKz = uses.reduce((sum, use) => sum + use.discountKz, 0);
    if (promotionStatus(promotion, spentKz, Date.now()) !== "paused") {
      throw apiError("invalid_transition", "Só é possível retomar uma promoção em pausa.");
    }

    await db.update(promotions).set({ paused: false }).where(eq(promotions.id, id));
    const updated = await loadPromotionOrNotFound(id);
    const next = promotionStatus(updated, spentKz, Date.now());

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "promotion.resume",
      targetModule: "promotion",
      targetId: id,
      targetLabel: label(promotion),
      changes: [{ field: "Estado", from: "paused", to: next }],
    });

    return dataEnvelope(await summary(updated, Date.now()));
  });

  app.post("/admin/promotions/:id/end", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "promotions.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body ?? {});
    const reason = requireReason(body.reason, "o motivo");

    const promotion = await loadPromotionOrNotFound(id);
    const uses = await db.select().from(promotionUses).where(eq(promotionUses.promotionId, id));
    const spentKz = uses.reduce((sum, use) => sum + use.discountKz, 0);
    const status = promotionStatus(promotion, spentKz, Date.now());
    if (status === "ended") throw apiError("invalid_transition", "A promoção já terminou.");

    await db.update(promotions).set({ endedAt: new Date() }).where(eq(promotions.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "promotion.end",
      targetModule: "promotion",
      targetId: id,
      targetLabel: label(promotion),
      reason,
      changes: [{ field: "Estado", from: status, to: "ended" }],
    });

    return dataEnvelope(await summary(await loadPromotionOrNotFound(id), Date.now()));
  });
}
