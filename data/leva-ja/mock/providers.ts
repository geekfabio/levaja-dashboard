import { isInProgress, isUpcoming } from "@/lib/leva-ja/scheduling";
import { documentsVerified, providerDisplayStatus } from "@/lib/leva-ja/eligibility";
import { ACTIVE_STATUSES } from "@/lib/leva-ja/status";
import type { ProviderAccount, Review } from "@/types/leva-ja";
import type { ProvidersRepository } from "../repositories/providers";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { hydrateRequest, refreshProvider, requiredDocuments, reviewFromRequest } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";

const ACCOUNT_LABELS: Record<ProviderAccount["accountStatus"], string> = {
  pending_approval: "Por aprovar",
  active: "Activo",
  suspended: "Suspenso",
};

export function createMockProviders(db: MockDatabase): ProvidersRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.providers, id, "Prestador");
  const view = (ctx: MockContext, provider: ProviderAccount) => refreshProvider(ctx.state, provider, ctx.today);

  const changeStatus = (
    ctx: MockContext,
    provider: ProviderAccount,
    next: ProviderAccount["accountStatus"],
    action: "provider.approve" | "provider.suspend" | "provider.reactivate",
    reason: string,
  ) => {
    const from = provider.accountStatus;
    provider.accountStatus = next;
    if (next === "suspended") {
      provider.availability = "offline";
      provider.suspensionReason = reason;
    } else {
      provider.suspensionReason = undefined;
      provider.suspendedUntil = undefined;
    }
    db.audit(ctx, action, { kind: "provider", id: provider.id, label: provider.name }, reason, [
      { field: "Estado da conta", from: ACCOUNT_LABELS[from], to: ACCOUNT_LABELS[next] },
    ]);
    db.commit("providers");
    return view(ctx, provider);
  };

  return {
    list: (filters = {}) =>
      db.run({ permission: "providers.view" }, (ctx) => {
        const items = ctx.state.providers
          .map((provider) => view(ctx, provider))
          .filter((provider) => {
            if (filters.status?.length && !filters.status.includes(providerDisplayStatus(provider))) return false;
            if (filters.verified !== undefined && provider.verified !== filters.verified) return false;
            if (filters.pendingApproval !== undefined && (provider.accountStatus === "pending_approval") !== filters.pendingApproval) return false;
            if (filters.zone?.length && !filters.zone.some((zone) => provider.zoneIds.includes(zone))) return false;
            if (filters.service?.length && !filters.service.some((service) => provider.services.includes(service))) return false;
            return matchesQuery(filters.q, provider.name, provider.phone, provider.email, provider.vehicle.plate);
          })
          .sort((a, b) => a.name.localeCompare(b.name, "pt"));
        return paginate(items, filters);
      }),

    get: (id) => db.run({ permission: "providers.view" }, (ctx) => view(ctx, find(ctx, id))),

    approve: (id, reason) =>
      db.run({ permission: "providers.manage" }, (ctx) => {
        const provider = find(ctx, id);
        if (provider.accountStatus !== "pending_approval") {
          throw new RepositoryError("invalid_transition", "Só é possível aprovar prestadores que aguardam aprovação.");
        }
        if (!documentsVerified(provider, ctx.today, requiredDocuments(ctx.state))) {
          throw new RepositoryError("validation", "Valide os documentos exigidos antes de aprovar o prestador.");
        }
        return changeStatus(ctx, provider, "active", "provider.approve", requireReason(reason));
      }),

    suspend: (id, reason) =>
      db.run({ permission: "providers.manage" }, (ctx) => {
        const provider = find(ctx, id);
        if (provider.accountStatus === "suspended") {
          throw new RepositoryError("invalid_transition", "O prestador já está suspenso.");
        }
        const why = requireReason(reason, "o motivo da suspensão");
        const busy = ctx.state.requests.some((request) => request.providerId === provider.id && isInProgress(request, ctx.now.getTime(), ctx.state.settings.dispatch.scheduleLeadMinutes));
        if (busy) {
          throw new RepositoryError("validation", "O prestador tem um pedido em curso. Reatribua-o antes de suspender.");
        }
        return changeStatus(ctx, provider, "suspended", "provider.suspend", why);
      }),

    reactivate: (id, reason) =>
      db.run({ permission: "providers.manage" }, (ctx) => {
        const provider = find(ctx, id);
        if (provider.accountStatus !== "suspended") {
          throw new RepositoryError("invalid_transition", "Só é possível reactivar prestadores suspensos.");
        }
        return changeStatus(ctx, provider, "active", "provider.reactivate", requireReason(reason));
      }),

    transactions: (id, query = {}) =>
      db.run({ permission: "providers.view" }, (ctx) => {
        find(ctx, id);
        const items = ctx.state.transactions
          .filter((transaction) => transaction.providerId === id)
          .sort(byNewest((transaction) => transaction.at))
          .map((transaction) => ({
            id: transaction.id,
            kind: transaction.kind,
            title: transaction.title,
            amount: transaction.amount,
            at: transaction.at,
            status: transaction.status,
            serviceKind: transaction.serviceKind,
          }));
        return paginate(items, query);
      }),

    reviews: (id, query = {}) =>
      db.run({ permission: "providers.view" }, (ctx) => {
        find(ctx, id);
        const items = ctx.state.requests
          .filter((request) => request.providerId === id)
          .map((request) => reviewFromRequest(request, ctx.state.clients.find((client) => client.id === request.clientId)))
          .filter((review): review is Review => review !== null)
          .sort(byNewest((review) => review.at));
        return paginate(items, query);
      }),

    requests: (id, query = {}) =>
      db.run({ permission: "providers.view" }, (ctx) => {
        find(ctx, id);
        const items = ctx.state.requests.filter((request) => request.providerId === id).sort(byNewest((request) => request.createdAt));
        const page = paginate(items, query);
        return { ...page, items: page.items.map((request) => hydrateRequest(ctx.state, request, ctx.today)) };
      }),

    positions: () =>
      db.run({ permission: "providers.view" }, (ctx) =>
        ctx.state.providers
          .filter((provider) => provider.availability === "online" && provider.accountStatus === "active")
          .map((provider) => ({
            id: provider.id,
            name: provider.name,
            initials: provider.initials,
            coords: provider.coords,
            services: provider.services,
            availability: provider.availability,
            rating: provider.rating,
            vehicleLabel: `${provider.vehicle.brand} ${provider.vehicle.model} · ${provider.vehicle.plate}`,
            vehicleClass: provider.vehicle.vehicleClass,
            activeRequestId: ctx.state.requests.find(
              (request) =>
                request.providerId === provider.id &&
                ACTIVE_STATUSES.includes(request.status) &&
                !isUpcoming(request, ctx.now.getTime(), ctx.state.settings.dispatch.scheduleLeadMinutes),
            )?.id,
          })),
      ),

    subscribe: (listener) => db.subscribe("providers", listener),
  };
}
