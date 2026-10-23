import { formatKz } from "@/lib/format";
import { PROMOTION_STATUS_LABELS, promotionIssues, promotionStatus } from "@/lib/leva-ja/commerce";
import type { Promotion } from "@/types/leva-ja";
import type { PromotionDetail, PromotionsRepository, PromotionSummary } from "../repositories/promotions";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

export function promotionSummary(state: MockState, promotion: Promotion, now: number): PromotionSummary {
  const { uses, ...rest } = promotion;
  const requests = new Map(state.requests.map((request) => [request.id, request]));
  return {
    ...rest,
    status: promotionStatus(promotion, now),
    spent: uses.reduce((sum, use) => sum + use.discount, 0),
    usesCount: uses.length,
    clients: new Set(uses.map((use) => use.clientId)).size,
    volume: uses.reduce((sum, use) => sum + (requests.get(use.requestId)?.price.total ?? 0), 0),
  };
}

export function createMockPromotions(db: MockDatabase): PromotionsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.promotions, id, "Promoção");
  const summary = (ctx: MockContext, promotion: Promotion) => promotionSummary(ctx.state, promotion, ctx.now.getTime());
  const label = (promotion: Promotion) => `${promotion.code} — ${promotion.name}`;

  return {
    list: (filters = {}) =>
      db.run({ permission: "promotions.view" }, (ctx) =>
        paginate(
          ctx.state.promotions
            .map((promotion) => summary(ctx, promotion))
            .filter((promotion) => (!filters.status?.length || filters.status.includes(promotion.status)) && matchesQuery(filters.q, promotion.code, promotion.name))
            .sort(byNewest((promotion) => promotion.startsAt)),
          filters,
        ),
      ),

    get: (id) =>
      db.run({ permission: "promotions.view" }, (ctx): PromotionDetail => {
        const promotion = find(ctx, id);
        return {
          ...summary(ctx, promotion),
          recentUses: [...promotion.uses]
            .sort((a, b) => (a.at < b.at ? 1 : -1))
            .slice(0, 15)
            .map((use) => ({
              ...use,
              requestCode: ctx.state.requests.find((request) => request.id === use.requestId)?.code ?? "—",
              clientName: ctx.state.clients.find((client) => client.id === use.clientId)?.name ?? "Cliente",
            })),
        };
      }),

    create: (input) =>
      db.run({ permission: "promotions.manage" }, (ctx) => {
        const issues = promotionIssues(input, ctx.state.promotions.map((promotion) => promotion.code));
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const promotion: Promotion = {
          ...input,
          id: db.nextId("promo"),
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          startsAt: new Date(input.startsAt).toISOString(),
          endsAt: new Date(input.endsAt).toISOString(),
          paused: false,
          createdAt: ctx.nowIso,
          createdBy: ctx.session.user.name,
          uses: [],
        };
        ctx.state.promotions.push(promotion);
        db.audit(ctx, "promotion.create", { kind: "promotion", id: promotion.id, label: label(promotion) }, undefined, [
          { field: "Desconto", from: "—", to: promotion.kind === "percent" ? `${promotion.value} %` : formatKz(promotion.value) },
          { field: "Orçamento", from: "—", to: formatKz(promotion.budget) },
        ]);
        db.commit("finance");
        return summary(ctx, promotion);
      }),

    pause: (id, reason) =>
      db.run({ permission: "promotions.manage" }, (ctx) => {
        const promotion = find(ctx, id);
        const status = promotionStatus(promotion, ctx.now.getTime());
        if (status !== "active" && status !== "scheduled") throw new RepositoryError("invalid_transition", `Não é possível pausar uma promoção «${PROMOTION_STATUS_LABELS[status].toLowerCase()}».`);
        const why = requireReason(reason, "o motivo");
        promotion.paused = true;
        db.audit(ctx, "promotion.pause", { kind: "promotion", id, label: label(promotion) }, why, [{ field: "Estado", from: PROMOTION_STATUS_LABELS[status], to: PROMOTION_STATUS_LABELS.paused }]);
        db.commit("finance");
        return summary(ctx, promotion);
      }),

    resume: (id) =>
      db.run({ permission: "promotions.manage" }, (ctx) => {
        const promotion = find(ctx, id);
        if (promotionStatus(promotion, ctx.now.getTime()) !== "paused") throw new RepositoryError("invalid_transition", "Só é possível retomar uma promoção em pausa.");
        promotion.paused = false;
        const next = promotionStatus(promotion, ctx.now.getTime());
        db.audit(ctx, "promotion.resume", { kind: "promotion", id, label: label(promotion) }, undefined, [{ field: "Estado", from: PROMOTION_STATUS_LABELS.paused, to: PROMOTION_STATUS_LABELS[next] }]);
        db.commit("finance");
        return summary(ctx, promotion);
      }),

    end: (id, reason) =>
      db.run({ permission: "promotions.manage" }, (ctx) => {
        const promotion = find(ctx, id);
        const status = promotionStatus(promotion, ctx.now.getTime());
        if (status === "ended") throw new RepositoryError("invalid_transition", "A promoção já terminou.");
        const why = requireReason(reason, "o motivo");
        promotion.endedAt = ctx.nowIso;
        db.audit(ctx, "promotion.end", { kind: "promotion", id, label: label(promotion) }, why, [{ field: "Estado", from: PROMOTION_STATUS_LABELS[status], to: PROMOTION_STATUS_LABELS.ended }]);
        db.commit("finance");
        return summary(ctx, promotion);
      }),
  };
}
