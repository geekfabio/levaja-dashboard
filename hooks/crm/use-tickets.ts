"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { TicketDraft } from "@/data/crm";
import { CLOSED_STATUSES, SLA_POLICIES, type Ticket, type TicketPriority, type TicketStatus } from "@/data/tickets";
import { recordEvent } from "@/stores/audit-store";
import { useTicketsStore } from "@/stores/tickets-store";

const TICKETS_KEY = ["crm", "tickets"] as const;

function ticketRef(ticket: Ticket) {
  return { module: "Tickets" as const, id: ticket.id, label: ticket.subject };
}

export function useTickets() {
  return useQuery({ queryKey: TICKETS_KEY, queryFn: () => repositories().tickets.list(), placeholderData: keepPreviousData });
}

export function useTicket(id: string | null) {
  const query = useTickets();
  return { ...query, data: id ? query.data?.find((ticket) => ticket.id === id) : undefined };
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: TICKETS_KEY });
}

export function useCreateTicket() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (draft: TicketDraft) => repositories().tickets.create(draft),
    onSuccess: (ticket) => {
      invalidate();
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
          action: { label: "Abrir", run: () => useTicketsStore.getState().openDetail(ticket.id) },
        },
      });
    },
  });
}

export function useAddTicketComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => repositories().tickets.addComment(id, body),
    onSuccess: (ticket) => {
      invalidate();
      recordEvent({ action: "comentou o ticket", target: ticketRef(ticket), companyId: ticket.companyId, notify: false });
    },
  });
}

export function useSetTicketStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus; from: TicketStatus }) => repositories().tickets.setStatus(id, status),
    onSuccess: (ticket, { from }) => {
      invalidate();
      if (ticket.status === from) return;
      const closing = CLOSED_STATUSES.includes(ticket.status);
      recordEvent({
        action: closing ? "resolveu o ticket" : "alterou o estado do ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        changes: [{ field: "Estado", from, to: ticket.status }],
      });
    },
  });
}

export function useSetTicketPriority() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: TicketPriority; from: TicketPriority }) => repositories().tickets.setPriority(id, priority),
    onSuccess: (ticket, { from }) => {
      invalidate();
      if (ticket.priority === from) return;
      const policy = SLA_POLICIES[ticket.priority];
      recordEvent({
        action: "alterou a prioridade do ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        notify: false,
        changes: [
          { field: "Prioridade", from, to: ticket.priority },
          { field: "SLA", to: `resposta ${policy.firstResponseHours} h · resolução ${policy.resolutionHours} h` },
        ],
      });
    },
  });
}

export function useSetTicketAssignee() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, assignee, avatar }: { id: string; assignee: string; avatar: string; from: string }) => repositories().tickets.setAssignee(id, assignee, avatar),
    onSuccess: (ticket, { from }) => {
      invalidate();
      if (ticket.assignee === from) return;
      recordEvent({
        action: "reatribuiu o ticket",
        target: ticketRef(ticket),
        companyId: ticket.companyId,
        changes: [{ field: "Responsável", from, to: ticket.assignee }],
      });
    },
  });
}
