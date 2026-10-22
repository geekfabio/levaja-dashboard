import type { Review, SosAlert, SosStatus, Ticket, TicketPriority, TicketStatus } from "@/types/leva-ja";
import type { Page, PageQuery, RealtimeListener, Unsubscribe } from "./common";

export type TicketFilters = PageQuery & {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assigneeId?: string;
  q?: string;
};

export type LowRatingItem = Review & {
  requestCode: string;
  providerId?: string;
  providerName?: string;
  handled: boolean;
  handledNote?: string;
};

export interface SupportRepository {
  tickets(filters?: TicketFilters): Promise<Page<Ticket>>;
  ticket(id: string): Promise<Ticket>;
  assignTicket(id: string, adminId: string): Promise<Ticket>;
  replyTicket(id: string, body: string): Promise<Ticket>;
  resolveTicket(id: string, resolution: string): Promise<Ticket>;
  sosAlerts(status?: SosStatus[]): Promise<SosAlert[]>;
  acknowledgeSos(id: string): Promise<SosAlert>;
  resolveSos(id: string, resolution: string): Promise<SosAlert>;
  lowRatings(query?: PageQuery & { handled?: boolean }): Promise<Page<LowRatingItem>>;
  markReviewHandled(id: string, note: string): Promise<LowRatingItem>;
  subscribe(listener: RealtimeListener): Unsubscribe;
}
