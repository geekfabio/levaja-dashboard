import { TICKET_STATUS_LABELS } from "@/lib/leva-ja/services";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { csatStats, ticketResponseSla } from "@/lib/leva-ja/trust";
import type { SosAlert, Ticket } from "@/types/leva-ja";
import type { LowRatingItem, SupportRepository } from "../repositories/support";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { reviewFromRequest } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

const PRIORITY_ORDER: Record<Ticket["priority"], number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<Ticket["status"], number> = { open: 0, in_progress: 1, resolved: 2 };

export function lowRatingItems(state: MockState): LowRatingItem[] {
  return state.requests
    .filter((request) => request.rating !== undefined && request.rating <= 2)
    .map((request): LowRatingItem | null => {
      const review = reviewFromRequest(request, state.clients.find((client) => client.id === request.clientId));
      const provider = state.providers.find((item) => item.id === request.providerId);
      const note = review ? state.reviewNotes[review.id] : undefined;
      return review
        ? {
            ...review,
            requestCode: request.code,
            providerId: provider?.id,
            providerName: provider?.name,
            handled: note !== undefined,
            handledNote: note,
          }
        : null;
    })
    .filter((item): item is LowRatingItem => item !== null)
    .sort(byNewest((item) => item.at));
}

export function createMockSupport(db: MockDatabase): SupportRepository {
  const findTicket = (ctx: MockContext, id: string) => findOr404(ctx.state.tickets, id, "Ocorrência");
  const findSos = (ctx: MockContext, id: string) => findOr404(ctx.state.sos, id, "Alerta SOS");
  const ticketEntity = (ticket: Ticket) => ({ kind: "ticket" as const, id: ticket.id, label: `${ticket.code} — ${ticket.subject}` });
  const sosEntity = (alert: SosAlert) => ({ kind: "sos" as const, id: alert.id, label: `SOS ${alert.requestCode} — ${alert.raisedByName}` });

  return {
    assignees: () =>
      db.run({ permission: "support.tickets" }, ({ state }) =>
        state.adminUsers
          .filter((user) => user.active && hasPermission(user.role, "support.tickets", state.rolePermissions))
          .map((user) => ({ id: user.id, name: user.name, initials: user.initials, role: user.role }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt")),
      ),

    tickets: (filters = {}) =>
      db.run({ permission: "support.tickets" }, ({ state }) => {
        const items = state.tickets
          .filter((ticket) => !filters.status?.length || filters.status.includes(ticket.status))
          .filter((ticket) => !filters.priority?.length || filters.priority.includes(ticket.priority))
          .filter((ticket) => !filters.assigneeId || ticket.assigneeId === filters.assigneeId)
          .filter((ticket) => matchesQuery(filters.q, ticket.code, ticket.subject, ticket.requesterName))
          .sort(
            (a, b) =>
              STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
              PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
              (a.updatedAt < b.updatedAt ? 1 : -1),
          );
        return paginate(items, filters);
      }),

    ticket: (id) => db.run({ permission: "support.tickets" }, (ctx) => findTicket(ctx, id)),

    assignTicket: (id, adminId) =>
      db.run({ permission: "support.tickets" }, (ctx) => {
        const ticket = findTicket(ctx, id);
        if (ticket.status === "resolved") throw new RepositoryError("invalid_transition", "A ocorrência já está resolvida.");
        const admin = findOr404(ctx.state.adminUsers, adminId, "Utilizador");
        if (!admin.active || !hasPermission(admin.role, "support.tickets", ctx.state.rolePermissions)) {
          throw new RepositoryError("validation", "Este utilizador não pode tratar ocorrências.");
        }
        if (ticket.assigneeId === admin.id) throw new RepositoryError("validation", "A ocorrência já está atribuída a este utilizador.");
        const from = ticket.assigneeName ?? "—";
        ticket.assigneeId = admin.id;
        ticket.assigneeName = admin.name;
        const fromStatus = ticket.status;
        ticket.status = "in_progress";
        ticket.updatedAt = ctx.nowIso;
        db.audit(ctx, "ticket.assign", ticketEntity(ticket), undefined, [
          { field: "Responsável", from, to: admin.name },
          ...(fromStatus !== ticket.status ? [{ field: "Estado", from: TICKET_STATUS_LABELS[fromStatus], to: TICKET_STATUS_LABELS.in_progress }] : []),
        ]);
        db.commit("support");
        return ticket;
      }),

    replyTicket: (id, body) =>
      db.run({ permission: "support.tickets" }, (ctx) => {
        const ticket = findTicket(ctx, id);
        if (ticket.status === "resolved") throw new RepositoryError("invalid_transition", "A ocorrência já está resolvida.");
        const text = requireReason(body, "a resposta");
        ticket.messages.push({ id: db.nextId("msg"), author: "admin", authorName: ctx.session.user.name, body: text, at: ctx.nowIso });
        if (ticket.status === "open") ticket.status = "in_progress";
        if (!ticket.assigneeId) {
          ticket.assigneeId = ctx.session.user.id;
          ticket.assigneeName = ctx.session.user.name;
        }
        ticket.updatedAt = ctx.nowIso;
        db.audit(ctx, "ticket.reply", ticketEntity(ticket), text);
        db.commit("support");
        return ticket;
      }),

    resolveTicket: (id, resolution) =>
      db.run({ permission: "support.tickets" }, (ctx) => {
        const ticket = findTicket(ctx, id);
        if (ticket.status === "resolved") throw new RepositoryError("invalid_transition", "A ocorrência já está resolvida.");
        const text = requireReason(resolution, "a resolução");
        const from = ticket.status;
        ticket.status = "resolved";
        ticket.resolution = text;
        ticket.resolvedAt = ctx.nowIso;
        ticket.updatedAt = ctx.nowIso;
        db.audit(ctx, "ticket.resolve", ticketEntity(ticket), text, [
          { field: "Estado", from: TICKET_STATUS_LABELS[from], to: TICKET_STATUS_LABELS.resolved },
        ]);
        db.commit("support");
        return ticket;
      }),

    sosAlerts: (status) =>
      db.run({ permission: "support.sos" }, ({ state }) =>
        state.sos.filter((alert) => !status?.length || status.includes(alert.status)).sort(byNewest((alert) => alert.createdAt)),
      ),

    acknowledgeSos: (id) =>
      db.run({ permission: "support.sos" }, (ctx) => {
        const alert = findSos(ctx, id);
        if (alert.status !== "open") throw new RepositoryError("invalid_transition", "O alerta já está a ser acompanhado.");
        alert.status = "acknowledged";
        alert.acknowledgedAt = ctx.nowIso;
        alert.handledBy = ctx.session.user.name;
        db.audit(ctx, "sos.acknowledge", sosEntity(alert), "Alerta em acompanhamento.");
        db.commit("support");
        return alert;
      }),

    resolveSos: (id, resolution) =>
      db.run({ permission: "support.sos" }, (ctx) => {
        const alert = findSos(ctx, id);
        if (alert.status === "resolved") throw new RepositoryError("invalid_transition", "O alerta já está resolvido.");
        const text = requireReason(resolution, "a resolução");
        alert.status = "resolved";
        alert.acknowledgedAt = alert.acknowledgedAt ?? ctx.nowIso;
        alert.resolvedAt = ctx.nowIso;
        alert.resolution = text;
        alert.handledBy = ctx.session.user.name;
        db.audit(ctx, "sos.resolve", sosEntity(alert), text);
        db.commit("support");
        return alert;
      }),

    lowRatings: (query = {}) =>
      db.run({ permission: "support.reviews" }, ({ state }) =>
        paginate(
          lowRatingItems(state).filter((item) => query.handled === undefined || item.handled === query.handled),
          query,
        ),
      ),

    markReviewHandled: (id, note) =>
      db.run({ permission: "support.reviews" }, (ctx) => {
        const item = lowRatingItems(ctx.state).find((entry) => entry.id === id);
        if (!item) throw new RepositoryError("not_found", "Avaliação não encontrada.");
        if (item.handled) throw new RepositoryError("invalid_transition", "Esta avaliação já foi revista.");
        const text = requireReason(note, "uma nota sobre a revisão");
        ctx.state.reviewNotes[id] = text;
        db.audit(ctx, "review.handled", { kind: "review", id, label: `${item.requestCode} — ${item.rating} estrela(s)` }, text);
        db.commit("support");
        return { ...item, handled: true, handledNote: text };
      }),

    responseSummary: () =>
      db.run({ permission: "support.tickets" }, ({ state, now }) => {
        const results = state.tickets.map((ticket) => ticketResponseSla(ticket, state.settings.support.firstResponseHours, now.getTime()));
        const answered = results.filter((result) => result.respondedAt);
        return {
          pending: results.filter((result) => result.status === "pending").length,
          atRisk: results.filter((result) => result.status === "at_risk").length,
          breached: results.filter((result) => result.status === "breached" && !result.respondedAt).length,
          metRate: answered.length ? answered.filter((result) => result.status === "met").length / answered.length : null,
        };
      }),

    satisfaction: () =>
      db.run({ permission: "support.tickets" }, ({ state }) => {
        const resolved = state.tickets.filter((ticket) => ticket.status === "resolved");
        const rated = resolved.filter((ticket) => ticket.satisfaction);
        const stats = csatStats(rated.map((ticket) => ticket.satisfaction?.score ?? 0));
        return {
          ...stats,
          responseRate: resolved.length ? rated.length / resolved.length : null,
          recent: rated
            .sort(byNewest((ticket) => ticket.satisfaction?.at ?? ticket.updatedAt))
            .slice(0, 10)
            .map((ticket) => ({
              ticketId: ticket.id,
              ticketCode: ticket.code,
              requesterName: ticket.requesterName,
              score: ticket.satisfaction?.score ?? 0,
              comment: ticket.satisfaction?.comment,
              at: ticket.satisfaction?.at ?? ticket.updatedAt,
            })),
        };
      }),

    subscribe: (listener) => db.subscribe("support", listener),
  };
}
