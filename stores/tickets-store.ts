import { create } from "zustand";
import { CURRENT_USER } from "@/data/companies";
import {
  CLOSED_STATUSES,
  SLA_POLICIES,
  TICKETS,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "@/data/tickets";
import { nowLuandaLocal } from "@/lib/format";
import { DEFAULT_FILTERS, type SlaFilter } from "@/lib/tickets";
import { recordEvent } from "./audit-store";

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function timelineEvent(label: string, date: string) {
  return { id: nextId("t"), label, date, author: CURRENT_USER.name };
}

function ticketRef(ticket: Ticket) {
  return { module: "Tickets" as const, id: ticket.id, label: ticket.subject };
}

type TicketsState = {
  tickets: Ticket[];
  status: string;
  priority: string;
  assignee: string;
  search: string;
  sla: SlaFilter;
  detailId: string | null;
  detailOpen: boolean;
  newTicketOpen: boolean;
  fromEmailOpen: boolean;
  setStatus: (status: string) => void;
  setPriority: (priority: string) => void;
  setAssignee: (assignee: string) => void;
  setSearch: (search: string) => void;
  setSla: (sla: SlaFilter) => void;
  resetFilters: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setNewTicketOpen: (open: boolean) => void;
  setFromEmailOpen: (open: boolean) => void;
  addTicket: (ticket: Ticket) => void;
  addComment: (ticketId: string, body: string) => void;
  setTicketStatus: (ticketId: string, status: TicketStatus) => void;
  setTicketPriority: (ticketId: string, priority: TicketPriority) => void;
  setTicketAssignee: (ticketId: string, assignee: string, avatar: string) => void;
};

export const useTicketsStore = create<TicketsState>((set, get) => {
  function update(ticketId: string, fn: (ticket: Ticket, now: string) => Partial<Ticket>) {
    const now = nowLuandaLocal();
    set((state) => ({
      tickets: state.tickets.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, ...fn(ticket, now), updatedAt: now } : ticket,
      ),
    }));
  }

  return {
    tickets: TICKETS,
    ...DEFAULT_FILTERS,
    detailId: null,
    detailOpen: false,
    newTicketOpen: false,
    fromEmailOpen: false,

    setStatus: (status) => set({ status }),
    setPriority: (priority) => set({ priority }),
    setAssignee: (assignee) => set({ assignee }),
    setSearch: (search) => set({ search }),
    setSla: (sla) => set({ sla }),
    resetFilters: () => set({ ...DEFAULT_FILTERS }),

    openDetail: (detailId) => set({ detailId, detailOpen: true }),
    closeDetail: () => set({ detailOpen: false }),
    setNewTicketOpen: (newTicketOpen) => set({ newTicketOpen }),
    setFromEmailOpen: (fromEmailOpen) => set({ fromEmailOpen }),

    addTicket: (ticket) => {
      set((state) => ({
        tickets: [ticket, ...state.tickets],
        newTicketOpen: false,
        fromEmailOpen: false,
      }));
      const policy = SLA_POLICIES[ticket.priority];
      recordEvent({
        action: "abriu o ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        changes: [
          { field: "Prioridade", to: ticket.priority },
          { field: "Responsável", to: ticket.assignee },
        ],
        toast: {
          title: "Ticket aberto",
          description: `Primeira resposta até ${policy.firstResponseHours} h (prioridade ${ticket.priority.toLowerCase()}).`,
          tone: "success",
          action: { label: "Abrir", run: () => get().openDetail(ticket.id) },
        },
      });
    },

    addComment: (ticketId, body) => {
      const ticket = get().tickets.find((item) => item.id === ticketId);
      if (!ticket) return;
      update(ticketId, (current, now) => ({
        firstResponseAt: current.firstResponseAt ?? now,
        comments: [
          ...current.comments,
          {
            id: nextId("c"),
            author: CURRENT_USER.name,
            authorAvatar: CURRENT_USER.avatar,
            body,
            date: now,
          },
        ],
        timeline: [
          ...current.timeline,
          timelineEvent(
            current.firstResponseAt ? "Comentário adicionado" : "Primeira resposta enviada",
            now,
          ),
        ],
      }));
      recordEvent({
        action: "comentou o ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        notify: false,
      });
    },

    setTicketStatus: (ticketId, status) => {
      const ticket = get().tickets.find((item) => item.id === ticketId);
      if (!ticket || ticket.status === status) return;
      const closing = CLOSED_STATUSES.includes(status);
      update(ticketId, (current, now) => ({
        status,
        firstResponseAt:
          current.firstResponseAt ?? (status === "Aberto" ? undefined : now),
        resolvedAt: closing ? (current.resolvedAt ?? now) : undefined,
        timeline: [...current.timeline, timelineEvent(`Estado alterado para ${status}`, now)],
      }));
      recordEvent({
        action: closing ? "resolveu o ticket" : "alterou o estado do ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        changes: [{ field: "Estado", from: ticket.status, to: status }],
      });
    },

    setTicketAssignee: (ticketId, assignee, avatar) => {
      const ticket = get().tickets.find((item) => item.id === ticketId);
      if (!ticket || ticket.assignee === assignee) return;
      update(ticketId, (current, now) => ({
        assignee,
        assigneeAvatar: avatar,
        timeline: [...current.timeline, timelineEvent(`Atribuído a ${assignee}`, now)],
      }));
      recordEvent({
        action: "reatribuiu o ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        changes: [{ field: "Responsável", from: ticket.assignee, to: assignee }],
      });
    },

    setTicketPriority: (ticketId, priority) => {
      const ticket = get().tickets.find((item) => item.id === ticketId);
      if (!ticket || ticket.priority === priority) return;
      update(ticketId, (current, now) => ({
        priority,
        timeline: [
          ...current.timeline,
          timelineEvent(`Prioridade alterada para ${priority}`, now),
        ],
      }));
      const policy = SLA_POLICIES[priority];
      recordEvent({
        action: "alterou a prioridade do ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        notify: false,
        changes: [
          { field: "Prioridade", from: ticket.priority, to: priority },
          {
            field: "SLA",
            to: `resposta ${policy.firstResponseHours} h · resolução ${policy.resolutionHours} h`,
          },
        ],
      });
    },
  };
});
