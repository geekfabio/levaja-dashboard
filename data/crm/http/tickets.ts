import type { Ticket, TicketPriority, TicketStatus } from "@/data/tickets";
import type { TicketDraft, TicketsRepository } from "../repositories/tickets";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpTickets(http: HttpClient): TicketsRepository {
  return {
    list: () => http.get<Ticket[]>("/crm/tickets"),
    get: (ticketId) => http.get<Ticket>(`/crm/tickets/${id(ticketId)}`),
    create: (draft: TicketDraft) => http.post<Ticket>("/crm/tickets", draft),
    addComment: (ticketId, body) => http.post<Ticket>(`/crm/tickets/${id(ticketId)}/comments`, { body }),
    setStatus: (ticketId, status: TicketStatus) => http.post<Ticket>(`/crm/tickets/${id(ticketId)}/status`, { status }),
    setPriority: (ticketId, priority: TicketPriority) => http.post<Ticket>(`/crm/tickets/${id(ticketId)}/priority`, { priority }),
    setAssignee: (ticketId, assignee, avatar) => http.post<Ticket>(`/crm/tickets/${id(ticketId)}/assignee`, { assignee, avatar }),
  };
}
