import { formatKz } from "@/lib/format";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { validatePricingConfig } from "@/lib/leva-ja/pricing";
import type { AuditChange, PricingConfig } from "@/types/leva-ja";
import type { PricingRepository, PricingUpdate } from "../repositories/pricing";
import { RepositoryError } from "../repositories/errors";
import type { MockDatabase } from "./database";
import { requireReason } from "./helpers";

function percent(value: number) {
  return `${Math.round(value * 1000) / 10} %`;
}

export function pricingChanges(before: PricingConfig, after: PricingUpdate): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const rule of after.rules) {
    const previous = before.rules.find((item) => item.kind === rule.kind);
    const name = SERVICE_SHORT_LABELS[rule.kind];
    if (previous?.base !== rule.base) changes.push({ field: `${name}: base`, from: formatKz(previous?.base ?? 0), to: formatKz(rule.base) });
    if (previous?.perKm !== rule.perKm) changes.push({ field: `${name}: por km`, from: formatKz(previous?.perKm ?? 0), to: formatKz(rule.perKm) });
  }
  for (const extra of after.extras) {
    const previous = before.extras.find((item) => item.id === extra.id);
    if (!previous) changes.push({ field: `Extra: ${extra.label}`, from: "—", to: formatKz(extra.amount) });
    else if (previous.amount !== extra.amount || previous.label !== extra.label || previous.kinds.join() !== extra.kinds.join()) {
      changes.push({ field: `Extra: ${extra.label}`, from: `${previous.label} · ${formatKz(previous.amount)}`, to: `${extra.label} · ${formatKz(extra.amount)}` });
    }
  }
  for (const extra of before.extras) {
    if (!after.extras.some((item) => item.id === extra.id)) changes.push({ field: `Extra: ${extra.label}`, from: formatKz(extra.amount), to: "Removido" });
  }
  if (before.platformFee !== after.platformFee) changes.push({ field: "Taxa da plataforma", from: formatKz(before.platformFee), to: formatKz(after.platformFee) });
  if (before.commissionRate !== after.commissionRate) changes.push({ field: "Comissão", from: percent(before.commissionRate), to: percent(after.commissionRate) });
  if (before.roundTo !== after.roundTo) changes.push({ field: "Arredondamento", from: formatKz(before.roundTo), to: formatKz(after.roundTo) });
  return changes;
}

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
