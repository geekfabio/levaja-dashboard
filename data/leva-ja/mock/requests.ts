import { distanceKm, eligibilityIssues } from "@/lib/leva-ja/eligibility";
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  canCancel,
  canDispute,
  canReassign,
  FORCE_COMPLETE_STATUSES,
  stepsUntil,
} from "@/lib/leva-ja/status";
import type { ServiceRequest } from "@/types/leva-ja";
import type { ReassignCandidate, RequestFilters, RequestsRepository } from "../repositories/requests";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { hydrateRequest, refreshProvider, syncRequestTransactions } from "./domain";
import { byNewest, findOr404, inRange, matchesQuery, paginate, requireReason } from "./helpers";
import type { StoredRequest } from "./state";

export function filterRequests(ctx: MockContext, filters: RequestFilters = {}) {
  const { state } = ctx;
  return state.requests
    .filter((request) => {
      if (filters.status?.length && !filters.status.includes(request.status)) return false;
      if (filters.kind?.length && !filters.kind.includes(request.kind)) return false;
      if (filters.zone?.length && !filters.zone.includes(request.zoneId)) return false;
      if (filters.paymentMethod?.length && (!request.paymentMethod || !filters.paymentMethod.includes(request.paymentMethod))) return false;
      if (filters.disputed !== undefined && Boolean(request.dispute && !request.dispute.resolvedAt) !== filters.disputed) return false;
      if (!inRange(request.createdAt, filters)) return false;
      if (filters.q) {
        const client = state.clients.find((item) => item.id === request.clientId);
        const provider = state.providers.find((item) => item.id === request.providerId);
        if (!matchesQuery(filters.q, request.code, client?.name, client?.phone, provider?.name, provider?.vehicle.plate)) return false;
      }
      return true;
    })
    .sort(byNewest((request) => request.createdAt));
}

function hydrate(ctx: MockContext, request: StoredRequest): ServiceRequest {
  return hydrateRequest(ctx.state, request, ctx.today);
}

export function createMockRequests(db: MockDatabase): RequestsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.requests, id, "Pedido");

  return {
    list: (filters = {}) =>
      db.run({ permission: "requests.view" }, (ctx) => {
        const page = paginate(filterRequests(ctx, filters), filters);
        return { ...page, items: page.items.map((request) => hydrate(ctx, request)) };
      }),

    get: (id) => db.run({ permission: "requests.view" }, (ctx) => hydrate(ctx, find(ctx, id))),

    reassignCandidates: (id) =>
      db.run({ permission: "requests.operate" }, (ctx) => {
        const request = find(ctx, id);
        const busy = new Set(
          ctx.state.requests
            .filter((item) => item.id !== request.id && item.providerId && ACTIVE_STATUSES.includes(item.status))
            .map((item) => item.providerId),
        );
        return ctx.state.providers
          .filter((provider) => provider.id !== request.providerId && provider.services.includes(request.kind))
          .map((provider): ReassignCandidate => {
            const account = refreshProvider(ctx.state, provider, ctx.today);
            return {
              provider: account,
              distanceKm: Math.round(distanceKm(account.coords, request.origin.coords) * 10) / 10,
              issues: eligibilityIssues(account, request, ctx.today),
            };
          })
          .filter((candidate) => !busy.has(candidate.provider.id))
          .sort((a, b) => a.issues.length - b.issues.length || a.distanceKm - b.distanceKm);
      }),

    reassign: (id, providerId, reason) =>
      db.run({ permission: "requests.operate" }, (ctx) => {
        const why = requireReason(reason);
        const request = find(ctx, id);
        if (!canReassign(request.status)) {
          throw new RepositoryError("invalid_transition", `Não é possível reatribuir um pedido em «${STATUS_LABELS[request.status]}».`);
        }
        if (request.providerId === providerId) {
          throw new RepositoryError("validation", "Escolha um prestador diferente do actual.");
        }
        const provider = findOr404(ctx.state.providers, providerId, "Prestador");
        const issues = eligibilityIssues(provider, request, ctx.today);
        if (issues.length) {
          throw new RepositoryError("validation", "O prestador escolhido não é elegível para este pedido.", [
            { field: "providerId", message: issues.join(",") },
          ]);
        }
        const busy = ctx.state.requests.some(
          (item) => item.id !== request.id && item.providerId === providerId && ACTIVE_STATUSES.includes(item.status),
        );
        if (busy) throw new RepositoryError("validation", "O prestador escolhido já tem um pedido em curso.");
        const previous = ctx.state.providers.find((item) => item.id === request.providerId);
        const fromStatus = request.status;
        request.providerId = provider.id;
        request.status = "assigned";
        request.timeline.push({ status: "assigned", at: ctx.nowIso });
        db.audit(ctx, "request.reassign", { kind: "request", id: request.id, label: request.code }, why, [
          { field: "Prestador", from: previous?.name ?? "—", to: provider.name },
          { field: "Estado", from: STATUS_LABELS[fromStatus], to: STATUS_LABELS.assigned },
        ]);
        db.commit("requests", "providers");
        return hydrate(ctx, request);
      }),

    cancel: (id, reason) =>
      db.run({ permission: "requests.operate" }, (ctx) => {
        const request = find(ctx, id);
        if (!canCancel(request.status)) {
          throw new RepositoryError("invalid_transition", `Não é possível cancelar um pedido em «${STATUS_LABELS[request.status]}».`);
        }
        const why = requireReason(reason, "o motivo do cancelamento");
        const fromStatus = request.status;
        request.status = "cancelled";
        request.cancelReason = why;
        request.timeline.push({ status: "cancelled", at: ctx.nowIso });
        syncRequestTransactions(ctx.state, request);
        db.audit(ctx, "request.cancel", { kind: "request", id: request.id, label: request.code }, why, [
          { field: "Estado", from: STATUS_LABELS[fromStatus], to: STATUS_LABELS.cancelled },
        ]);
        db.commit("requests", "providers");
        return hydrate(ctx, request);
      }),

    openDispute: (id, reason) =>
      db.run({ permission: "requests.dispute" }, (ctx) => {
        const request = find(ctx, id);
        if (!canDispute(request.status)) {
          throw new RepositoryError("invalid_transition", "Só é possível abrir disputa depois da recolha confirmada.");
        }
        if (request.dispute && !request.dispute.resolvedAt) {
          throw new RepositoryError("validation", "Este pedido já tem uma disputa aberta.");
        }
        const why = requireReason(reason, "o motivo da disputa");
        request.dispute = { reason: why, openedAt: ctx.nowIso, openedBy: ctx.session.user.name };
        db.audit(ctx, "request.dispute", { kind: "request", id: request.id, label: request.code }, why);
        db.commit("requests");
        return hydrate(ctx, request);
      }),

    forceComplete: (id, reason) =>
      db.run({ permission: "requests.operate" }, (ctx) => {
        const request = find(ctx, id);
        if (!request.dispute || request.dispute.resolvedAt) {
          throw new RepositoryError("invalid_transition", "Só é possível forçar a conclusão de um pedido em disputa.");
        }
        if (!FORCE_COMPLETE_STATUSES.includes(request.status)) {
          throw new RepositoryError("invalid_transition", `Não é possível forçar a conclusão em «${STATUS_LABELS[request.status]}».`);
        }
        const why = requireReason(reason, "a resolução da disputa");
        const fromStatus = request.status;
        const steps = stepsUntil(request.status, "rated");
        let at = Date.parse(ctx.nowIso);
        for (const status of steps) {
          request.status = status;
          request.timeline.push({ status, at: new Date(at).toISOString() });
          at += 1000;
        }
        if (!request.proof) request.proof = { receivedBy: "Confirmado pela operação", at: ctx.nowIso, photoLabel: "Sem fotografia" };
        if (!request.paymentMethod) request.paymentMethod = "cash";
        request.dispute = { ...request.dispute, resolvedAt: ctx.nowIso, resolution: why };
        syncRequestTransactions(ctx.state, request);
        db.audit(ctx, "request.force_complete", { kind: "request", id: request.id, label: request.code }, why, [
          { field: "Estado", from: STATUS_LABELS[fromStatus], to: STATUS_LABELS.rated },
        ]);
        db.commit("requests", "providers", "finance");
        return hydrate(ctx, request);
      }),

    active: () =>
      db.run({ permission: "requests.view" }, (ctx) =>
        ctx.state.requests
          .filter((request) => ACTIVE_STATUSES.includes(request.status))
          .sort(byNewest((request) => request.createdAt))
          .map((request) => hydrate(ctx, request)),
      ),

    subscribe: (listener) => db.subscribe("requests", listener),
  };
}
