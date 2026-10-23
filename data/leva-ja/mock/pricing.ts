import { pricingChanges, validatePricingConfig } from "@/lib/leva-ja/pricing";
import type { PricingRepository } from "../repositories/pricing";
import { RepositoryError } from "../repositories/errors";
import type { MockDatabase } from "./database";
import { requireReason } from "./helpers";

export function createMockPricing(db: MockDatabase): PricingRepository {
  return {
    get: () => db.run({ permission: "pricing.view" }, ({ state }) => state.pricing),

    update: (update, reason) =>
      db.run({ permission: "pricing.edit" }, (ctx) => {
        const why = requireReason(reason, "o motivo da alteração");
        const issues = validatePricingConfig(update);
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const changes = pricingChanges(ctx.state.pricing, update);
        if (!changes.length) throw new RepositoryError("validation", "Não há alterações para guardar.");
        ctx.state.pricing = {
          rules: structuredClone(update.rules),
          extras: structuredClone(update.extras),
          platformFee: update.platformFee,
          commissionRate: update.commissionRate,
          roundTo: update.roundTo,
          updatedAt: ctx.nowIso,
          updatedBy: ctx.session.user.name,
        };
        db.audit(ctx, "pricing.update", { kind: "pricing", id: "pricing", label: "Tabela de preços" }, why, changes);
        db.commit();
        return ctx.state.pricing;
      }),
  };
}
