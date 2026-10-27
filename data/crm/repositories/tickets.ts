import type { Ticket, TicketOrigin, TicketPriority, TicketStatus } from "@/data/tickets";

export type TicketDraft = {
  subject: string;
  description: string;
  companyId?: string;
  companyName?: string;
  contactName?: string;
  priority: TicketPriority;
  origin: TicketOrigin;
  assignee: string;
  assigneeAvatar: string;
};

export interface TicketsRepository {
  list(): Promise<Ticket[]>;
  get(id: string): Promise<Ticket>;
  create(draft: TicketDraft): Promise<Ticket>;
  addComment(id: string, body: string): Promise<Ticket>;
  setStatus(id: string, status: TicketStatus): Promise<Ticket>;
  setPriority(id: string, priority: TicketPriority): Promise<Ticket>;
  setAssignee(id: string, assignee: string, avatar: string): Promise<Ticket>;
}
