import type { Review } from "@/types/leva-ja";
import type { ClientsRepository } from "../repositories/clients";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { hydrateRequest, refreshClient, reviewFromRequest } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";

export function createMockClients(db: MockDatabase): ClientsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.clients, id, "Cliente");

  const setBlocked = (id: string, blocked: boolean, reason: string) =>
    db.run({ permission: "clients.block" }, (ctx) => {
      const client = find(ctx, id);
      if (client.blocked === blocked) {
        throw new RepositoryError("invalid_transition", blocked ? "O cliente já está bloqueado." : "O cliente não está bloqueado.");
      }
      const why = requireReason(reason, blocked ? "o motivo do bloqueio" : "o motivo do desbloqueio");
      client.blocked = blocked;
      client.blockedReason = blocked ? why : undefined;
      db.audit(ctx, blocked ? "client.block" : "client.unblock", { kind: "client", id: client.id, label: client.name }, why, [
        { field: "Estado", from: blocked ? "Activo" : "Bloqueado", to: blocked ? "Bloqueado" : "Activo" },
      ]);
      db.commit("support");
      return refreshClient(ctx.state, client);
    });

  return {
    list: (filters = {}) =>
      db.run({ permission: "clients.view" }, (ctx) => {
        const items = ctx.state.clients
          .filter((client) => filters.blocked === undefined || client.blocked === filters.blocked)
          .filter((client) => matchesQuery(filters.q, client.name, client.email, client.phone))
          .map((client) => refreshClient(ctx.state, client))
          .sort((a, b) => a.name.localeCompare(b.name, "pt"));
        return paginate(items, filters);
      }),

    get: (id) => db.run({ permission: "clients.view" }, (ctx) => refreshClient(ctx.state, find(ctx, id))),

    requests: (id, query = {}) =>
      db.run({ permission: "clients.view" }, (ctx) => {
        find(ctx, id);
        const items = ctx.state.requests.filter((request) => request.clientId === id).sort(byNewest((request) => request.createdAt));
        const page = paginate(items, query);
        return { ...page, items: page.items.map((request) => hydrateRequest(ctx.state, request, ctx.today)) };
      }),

    reviewsGiven: (id) =>
      db.run({ permission: "clients.view" }, (ctx) => {
        const client = find(ctx, id);
        return ctx.state.requests
          .filter((request) => request.clientId === id)
          .map((request) => reviewFromRequest(request, client))
          .filter((review): review is Review => review !== null)
          .sort(byNewest((review) => review.at));
      }),

    tickets: (id) =>
      db.run({ permission: "clients.view" }, (ctx) => {
        find(ctx, id);
        return ctx.state.tickets
          .filter((ticket) => ticket.requesterKind === "client" && ticket.requesterId === id)
          .sort(byNewest((ticket) => ticket.createdAt));
      }),

    block: (id, reason) => setBlocked(id, true, reason),
    unblock: (id, reason) => setBlocked(id, false, reason),
  };
}
