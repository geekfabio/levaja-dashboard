import type { ClientAccount, Review, ServiceRequest, Ticket } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type ClientFilters = PageQuery & { q?: string; blocked?: boolean };

export interface ClientsRepository {
  list(filters?: ClientFilters): Promise<Page<ClientAccount>>;
  get(id: string): Promise<ClientAccount>;
  requests(id: string, query?: PageQuery): Promise<Page<ServiceRequest>>;
  reviewsGiven(id: string): Promise<Review[]>;
  tickets(id: string): Promise<Ticket[]>;
  block(id: string, reason: string): Promise<ClientAccount>;
  unblock(id: string, reason: string): Promise<ClientAccount>;
}
