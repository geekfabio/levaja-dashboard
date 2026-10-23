import { formatDateNumeric, formatKz } from "@/lib/format";
import { PENALTY_KIND_LABELS, isPenaltyActive, penaltyIssues, qualityScore } from "@/lib/leva-ja/quality";
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from "@/lib/leva-ja/status";
import type { Penalty, ProviderAccount, ProviderQuality } from "@/types/leva-ja";
import type { QualityRepository } from "../repositories/quality";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, MINUTE, eventAt } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate } from "./helpers";
import type { MockState } from "./state";

export function providerQuality(state: MockState, provider: ProviderAccount, now: number): ProviderQuality {
  const since = new Date(now - 30 * DAY).toISOString();
  const own = state.requests.filter((request) => request.providerId === provider.id && request.createdAt >= since);
  const arrivals = own.flatMap((request) => {
    const assigned = eventAt(request, "assigned");
    const arrived = eventAt(request, "arrived");
    return assigned && arrived ? [Math.max(0, Math.round((Date.parse(arrived) - Date.parse(assigned)) / MINUTE))] : [];
  });
  const completed = own.filter((request) => COMPLETED_STATUSES.includes(request.status)).length;
  const cancelled = own.filter((request) => request.status === "cancelled").length;
  const result = qualityScore(
    {
      completed,
      cancelled,
      arrivals,
      ratings: own.flatMap((request) => (request.rating === undefined ? [] : [request.rating])),
      disputes: own.filter((request) => request.dispute).length,
      joinedDaysAgo: (now - Date.parse(provider.joinedAt)) / DAY,
      active: provider.accountStatus === "active",
    },
    { arrivalTargetMinutes: state.settings.dispatch.arrivalTargetMinutes, cancelLimit: state.settings.cancellation.providerCancelLimit },
  );
  return {
    providerId: provider.id,
    providerName: provider.name,
    accountStatus: provider.accountStatus,
    fleetId: provider.fleetId,
    completed,
    cancelled,
    ...result,
    disputes: own.filter((request) => request.dispute).length,
    activePenalties: state.penalties.filter((penalty) => penalty.providerId === provider.id && isPenaltyActive(penalty, now)).length,
  };
}

export function syncPenaltyTransaction(state: MockState, penalty: Penalty) {
  const id = `tx-${penalty.id}`;
  state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
  if (penalty.kind !== "fine" || penalty.revokedAt || !penalty.amount) return;
  state.transactions.push({
    id,
    kind: "penalty",
    title: `Multa — ${penalty.reason}`,
    amount: -penalty.amount,
    at: penalty.createdAt,
    status: "completed",
    providerId: penalty.providerId,
    providerName: penalty.providerName,
  });
}

export function createMockQuality(db: MockDatabase): QualityRepository {
  const label = (penalty: Penalty) =>
    `${PENALTY_KIND_LABELS[penalty.kind]} — ${penalty.providerName}${penalty.amount ? ` · ${formatKz(penalty.amount)}` : ""}${penalty.days ? ` · ${penalty.days} dias` : ""}`;
  const scoresOf = (ctx: MockContext) =>
    ctx.state.providers.filter((provider) => provider.accountStatus !== "pending_approval").map((provider) => providerQuality(ctx.state, provider, ctx.now.getTime()));

  return {
    scores: (filters = {}) =>
      db.run({ permission: "providers.view" }, (ctx) => {
        const all = scoresOf(ctx);
        const sorters = {
          score: (a: ProviderQuality, b: ProviderQuality) => a.score - b.score,
          cancellations: (a: ProviderQuality, b: ProviderQuality) => b.cancellationRate - a.cancellationRate,
          late: (a: ProviderQuality, b: ProviderQuality) => b.lateRate - a.lateRate,
        };
        const items = all
          .filter((item) => {
            if (filters.flag?.length && !filters.flag.some((flag) => item.flags.includes(flag))) return false;
            if (filters.fleetId && item.fleetId !== filters.fleetId) return false;
            return matchesQuery(filters.q, item.providerName);
          })
          .sort(sorters[filters.sort ?? "score"]);
        return {
          ...paginate(items, filters),
          totals: {
            flagged: all.filter((item) => item.flags.length > 0).length,
            averageScore: all.length ? Math.round(all.reduce((sum, item) => sum + item.score, 0) / all.length) : 0,
            activePenalties: ctx.state.penalties.filter((penalty) => isPenaltyActive(penalty, ctx.now.getTime())).length,
          },
        };
      }),

    provider: (providerId) =>
      db.run({ permission: "providers.view" }, (ctx) => providerQuality(ctx.state, findOr404(ctx.state.providers, providerId, "Prestador"), ctx.now.getTime())),

    penalties: (filters = {}) =>
      db.run({ permission: "providers.view" }, (ctx) =>
        paginate(
          ctx.state.penalties
            .filter((penalty) => {
              if (filters.providerId && penalty.providerId !== filters.providerId) return false;
              if (filters.kind?.length && !filters.kind.includes(penalty.kind)) return false;
              if (filters.active !== undefined && isPenaltyActive(penalty, ctx.now.getTime()) !== filters.active) return false;
              return true;
            })
            .sort(byNewest((penalty) => penalty.createdAt)),
          filters,
        ),
      ),

    penalize: (providerId, input) =>
      db.run({ permission: "providers.penalize" }, (ctx) => {
        const provider = findOr404(ctx.state.providers, providerId, "Prestador");
        if (provider.accountStatus === "pending_approval") throw new RepositoryError("invalid_transition", "O prestador ainda não foi aprovado.");
        const issues = penaltyIssues(input);
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const penalty: Penalty = {
          id: db.nextId("pen"),
          providerId,
          providerName: provider.name,
          kind: input.kind,
          reason: input.reason.trim(),
          amount: input.kind === "fine" ? input.amount : undefined,
          days: input.kind === "suspension" ? input.days : undefined,
          createdAt: ctx.nowIso,
          createdBy: ctx.session.user.name,
        };
        const changes = [];
        if (input.kind === "suspension") {
          if (provider.accountStatus === "suspended") throw new RepositoryError("invalid_transition", "O prestador já está suspenso.");
          const busy = ctx.state.requests.some((request) => request.providerId === provider.id && ACTIVE_STATUSES.includes(request.status));
          if (busy) throw new RepositoryError("validation", "O prestador tem um pedido em curso. Reatribua-o antes de suspender.");
          penalty.until = new Date(ctx.now.getTime() + (input.days ?? 1) * DAY).toISOString();
          provider.accountStatus = "suspended";
          provider.availability = "offline";
          provider.suspendedUntil = penalty.until;
          provider.suspensionReason = `Suspensão temporária até ${formatDateNumeric(penalty.until)}: ${penalty.reason}`;
          changes.push({ field: "Estado da conta", from: "Activo", to: `Suspenso até ${formatDateNumeric(penalty.until)}` });
        }
        if (input.kind === "fine") changes.push({ field: "Carteira", from: "—", to: `−${formatKz(input.amount ?? 0)}` });
        ctx.state.penalties.push(penalty);
        syncPenaltyTransaction(ctx.state, penalty);
        db.audit(ctx, "penalty.issue", { kind: "penalty", id: penalty.id, label: label(penalty) }, penalty.reason, changes);
        db.commit("providers", "finance");
        return penalty;
      }),

    revoke: (id, reason) =>
      db.run({ permission: "providers.penalize" }, (ctx) => {
        const penalty = findOr404(ctx.state.penalties, id, "Penalização");
        if (penalty.revokedAt) throw new RepositoryError("invalid_transition", "A penalização já foi anulada.");
        const why = reason?.trim() ?? "";
        if (why.length < 3) throw new RepositoryError("validation", "Indique o motivo da anulação.", [{ field: "reason", message: "Indique o motivo da anulação." }]);
        penalty.revokedAt = ctx.nowIso;
        penalty.revokedBy = ctx.session.user.name;
        penalty.revokeReason = why;
        const provider = ctx.state.providers.find((item) => item.id === penalty.providerId);
        if (penalty.kind === "suspension" && provider && provider.accountStatus === "suspended" && provider.suspendedUntil === penalty.until) {
          provider.accountStatus = "active";
          provider.suspendedUntil = undefined;
          provider.suspensionReason = undefined;
        }
        syncPenaltyTransaction(ctx.state, penalty);
        db.audit(ctx, "penalty.revoke", { kind: "penalty", id: penalty.id, label: label(penalty) }, why);
        db.commit("providers", "finance");
        return penalty;
      }),
  };
}
