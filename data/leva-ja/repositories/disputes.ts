import type { DisputeCategory, DisputeOutcome, ServiceRequest } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type DisputeFilters = PageQuery & {
  state?: "open" | "resolved" | "overdue";
  category?: DisputeCategory[];
  q?: string;
};

export type DisputeCase = { request: ServiceRequest; refundable: number; refunded: number; overdue: boolean };

export type DisputeSummary = { open: number; overdue: number; resolvedLast30: number; refundedLast30: number };

export type ResolveDisputeInput = {
  outcome: DisputeOutcome;
  amount?: number;
  chargeProvider?: boolean;
  resolution: string;
};

export interface DisputesRepository {
  list(filters?: DisputeFilters): Promise<Page<DisputeCase>>;
  summary(): Promise<DisputeSummary>;
  addNote(requestId: string, text: string): Promise<ServiceRequest>;
  setCategory(requestId: string, category: DisputeCategory): Promise<ServiceRequest>;
  resolve(requestId: string, input: ResolveDisputeInput): Promise<ServiceRequest>;
}
