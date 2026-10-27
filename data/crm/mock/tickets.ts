import { CURRENT_USER } from "@/data/companies";
import { CLOSED_STATUSES, type Ticket, type TicketStatus } from "@/data/tickets";
import { nowLuandaLocal } from "@/lib/format";
import { RepositoryError } from "../repositories/errors";
import type { TicketDraft, TicketsRepository } from "../repositories/tickets";
import type { CrmMockDatabase } from "./database";

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createMockTickets(db: CrmMockDatabase): TicketsRepository {
  function find(id: string) {
    const ticket = db.state.tickets.find((item) => item.id === id);
    if (!ticket) throw new RepositoryError("not_found", "O ticket não existe ou foi removido.");
    return ticket;
  }

  function timeline(ticket: Ticket, label: string, author = CURRENT_USER.name) {
    ticket.timeline.push({ id: newId("t"), label, date: nowLuandaLocal(), author });
  }

  return {
    list: () => db.run((state) => state.tickets),

    get: (id) => db.run(() => find(id)),

    create: (draft: TicketDraft) =>
      db.run((state) => {
        const subject = draft.subject.trim();
        if (!subject) throw new RepositoryError("validation", "Indique o assunto do ticket.", [{ field: "subject", message: "Indique o assunto do ticket." }]);
        const now = nowLuandaLocal();
        const fromEmail = draft.origin === "E-mail";
        const ticket: Ticket = {
          id: newId("tk"),
          subject,
          description: draft.description.trim(),
          companyId: draft.companyId,
          companyName: draft.companyName,
          contactName: draft.contactName?.trim() || undefined,
          status: "Aberto",
          priority: draft.priority,
          origin: draft.origin,
          assignee: draft.assignee,
          assigneeAvatar: draft.assigneeAvatar,
          createdAt: now,
          updatedAt: now,
          comments: [],
          timeline: [
            {
              id: newId("t"),
              label: fromEmail ? "Ticket criado a partir de e-mail" : "Ticket criado",
              date: now,
              author: fromEmail ? draft.contactName?.trim() || "E-mail" : CURRENT_USER.name,
            },
          ],
        };
        state.tickets.unshift(ticket);
        return ticket;
      }),

    addComment: (id, body) =>
      db.run(() => {
        const ticket = find(id);
        const text = body.trim();
        if (!text) throw new RepositoryError("validation", "Escreva um comentário.");
        const now = nowLuandaLocal();
        const firstResponse = !ticket.firstResponseAt;
        ticket.firstResponseAt = ticket.firstResponseAt ?? now;
        ticket.comments.push({ id: newId("c"), author: CURRENT_USER.name, authorAvatar: CURRENT_USER.avatar, body: text, date: now });
        timeline(ticket, firstResponse ? "Primeira resposta enviada" : "Comentário adicionado");
        ticket.updatedAt = now;
        return ticket;
      }),

    setStatus: (id, status: TicketStatus) =>
      db.run(() => {
        const ticket = find(id);
        if (ticket.status === status) return ticket;
        const now = nowLuandaLocal();
        const closing = CLOSED_STATUSES.includes(status);
        ticket.status = status;
        ticket.firstResponseAt = ticket.firstResponseAt ?? (status === "Aberto" ? undefined : now);
        ticket.resolvedAt = closing ? ticket.resolvedAt ?? now : undefined;
        timeline(ticket, `Estado alterado para ${status}`);
        ticket.updatedAt = now;
        return ticket;
      }),

    setPriority: (id, priority) =>
      db.run(() => {
        const ticket = find(id);
        if (ticket.priority === priority) return ticket;
        ticket.priority = priority;
        timeline(ticket, `Prioridade alterada para ${priority}`);
        ticket.updatedAt = nowLuandaLocal();
        return ticket;
      }),

    setAssignee: (id, assignee, avatar) =>
      db.run(() => {
        const ticket = find(id);
        if (ticket.assignee === assignee) return ticket;
        ticket.assignee = assignee;
        ticket.assigneeAvatar = avatar;
        timeline(ticket, `Atribuído a ${assignee}`);
        ticket.updatedAt = nowLuandaLocal();
        return ticket;
      }),
  };
}
