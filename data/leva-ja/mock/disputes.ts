import { formatKz } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { DISPUTE_CATEGORY_LABELS, DISPUTE_OUTCOME_LABELS, committedRefunds, isDisputeOverdue, refundableAmount } from "@/lib/leva-ja/refunds";
import type { DisputesRepository } from "../repositories/disputes";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, hydrateRequest } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";
import { createRefundRecord } from "./refunds";
import type { StoredRequest } from "./state";

export function createMockDisputes(db: MockDatabase): DisputesRepository {
  const hydrate = (ctx: MockContext, request: StoredRequest) => hydrateRequest(ctx.state, request, ctx.today);
  const findOpen = (ctx: MockContext, id: string) => {
    const request = findOr404(ctx.state.requests, id, "Pedido");
    if (!request.dispute) throw new RepositoryError("not_found", "Este pedido não tem disputa.");
    if (request.dispute.resolvedAt) throw new RepositoryError("invalid_transition", "A disputa já foi resolvida.");
    return request as StoredRequest & { dispute: NonNullable<StoredRequest["dispute"]> };
  };

  return {
    list: (filters = {}) =>
      db.run({ permission: "requests.dispute" }, (ctx) => {
        const now = ctx.now.getTime();
        const items = ctx.state.requests
          .filter((request) => {
            const dispute = request.dispute;
            if (!dispute) return false;
            if (filters.state === "open" && dispute.resolvedAt) return false;
            if (filters.state === "resolved" && !dispute.resolvedAt) return false;
            if (filters.state === "overdue" && !isDisputeOverdue(dispute, now)) return false;
            if (filters.category?.length && !filters.category.includes(dispute.category ?? "other")) return false;
            const client = ctx.state.clients.find((item) => item.id === request.clientId);
            const provider = ctx.state.providers.find((item) => item.id === request.providerId);
            return matchesQuery(filters.q, request.code, client?.name, provider?.name, dispute.reason);
          })
          .sort(byNewest((request) => request.dispute?.openedAt ?? request.createdAt))
          .map((request) => ({
            request: hydrate(ctx, request),
            refundable: refundableAmount(request, ctx.state.refunds),
            refunded: committedRefunds(ctx.state.refunds, request.id),
            overdue: isDisputeOverdue(request.dispute ?? { openedAt: request.createdAt }, now),
          }));
        return paginate(items, filters);
      }),

    summary: () =>
      db.run({ permission: "requests.dispute" }, (ctx) => {
        const now = ctx.now.getTime();
        const since = new Date(now - 30 * DAY).toISOString();
        const disputed = ctx.state.requests.filter((request) => request.dispute);
        const resolved = disputed.filter((request) => (request.dispute?.resolvedAt ?? "") >= since);
        return {
          open: disputed.filter((request) => !request.dispute?.resolvedAt).length,
          overdue: disputed.filter((request) => request.dispute && isDisputeOverdue(request.dispute, now)).length,
          resolvedLast30: resolved.length,
          refundedLast30: ctx.state.refunds
            .filter((refund) => refund.source === "dispute" && refund.status !== "rejected" && refund.requestedAt >= since)
            .reduce((sum, refund) => sum + refund.amount, 0),
        };
      }),

    addNote: (requestId, text) =>
      db.run({ permission: "requests.dispute" }, (ctx) => {
        const request = findOpen(ctx, requestId);
        const note = requireReason(text, "o texto da nota");
        request.dispute.notes = [...(request.dispute.notes ?? []), { id: db.nextId("dn"), author: ctx.session.user.name, text: note, at: ctx.nowIso }];
        db.audit(ctx, "dispute.note", { kind: "request", id: request.id, label: request.code }, note);
        db.commit("requests");
        return hydrate(ctx, request);
      }),

    setCategory: (requestId, category) =>
      db.run({ permission: "requests.dispute" }, (ctx) => {
        const request = findOpen(ctx, requestId);
        if (!(category in DISPUTE_CATEGORY_LABELS)) throw new RepositoryError("validation", "Categoria desconhecida.");
        const from = DISPUTE_CATEGORY_LABELS[request.dispute.category ?? "other"];
        request.dispute.category = category;
        db.audit(ctx, "dispute.note", { kind: "request", id: request.id, label: request.code }, "Categoria da disputa alterada.", [
          { field: "Categoria", from, to: DISPUTE_CATEGORY_LABELS[category] },
        ]);
        db.commit("requests");
        return hydrate(ctx, request);
      }),

    resolve: (requestId, input) =>
      db.run({ permission: "requests.dispute" }, (ctx) => {
        const request = findOpen(ctx, requestId);
        const resolution = requireReason(input.resolution, "a resolução da disputa");
        let refundId: string | undefined;
        const changes = [{ field: "Resultado", from: "—", to: DISPUTE_OUTCOME_LABELS[input.outcome] }];
        if (input.outcome !== "no_refund") {
          if (!hasPermission(ctx.session.user.role, "refunds.request", ctx.state.rolePermissions)) {
            throw new RepositoryError("forbidden", "O seu papel não pode pedir reembolsos.");
          }
          const available = refundableAmount(request, ctx.state.refunds);
          if (available <= 0) {
            throw new RepositoryError("validation", "O pedido não tem valor pago por reembolsar. Resolva sem reembolso.");
          }
          const amount = input.outcome === "refund_full" ? available : Math.round(input.amount ?? 0);
          if (input.outcome === "refund_partial" && amount >= available) {
            throw new RepositoryError("validation", "Um reembolso parcial tem de ser menor do que o valor por reembolsar.", [
              { field: "amount", message: "Para devolver tudo, escolha reembolso total." },
            ]);
          }
          const refund = createRefundRecord(db, ctx, request, { amount, reason: resolution, chargeProvider: Boolean(input.chargeProvider) }, "dispute");
          refundId = refund.id;
          changes.push({ field: "Reembolso", from: "—", to: `${refund.code} · ${formatKz(refund.amount)}` });
        }
        request.dispute = {
          ...request.dispute,
          resolvedAt: ctx.nowIso,
          resolvedBy: ctx.session.user.name,
          resolution,
          outcome: input.outcome,
          refundId,
        };
        db.audit(ctx, "dispute.resolve", { kind: "request", id: request.id, label: request.code }, resolution, changes);
        db.commit("requests", "finance");
        return hydrate(ctx, request);
      }),
  };
}
