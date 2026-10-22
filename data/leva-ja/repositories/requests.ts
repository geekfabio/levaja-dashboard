import type { DisputeCategory, PaymentMethodKind, ProviderAccount, ServiceKind, ServiceRequest, ServiceStatus } from "@/types/leva-ja";
import type { EligibilityIssue } from "@/lib/leva-ja/eligibility";
import type { DateRange, Page, PageQuery, RealtimeListener, Unsubscribe } from "./common";

export type RequestFilters = DateRange &
  PageQuery & {
    status?: ServiceStatus[];
    kind?: ServiceKind[];
    zone?: string[];
    paymentMethod?: PaymentMethodKind[];
    q?: string;
    disputed?: boolean;
  };

export type ReassignCandidate = {
  provider: ProviderAccount;
  distanceKm: number;
  issues: EligibilityIssue[];
};

export interface RequestsRepository {
  list(filters?: RequestFilters): Promise<Page<ServiceRequest>>;
  get(id: string): Promise<ServiceRequest>;
  reassignCandidates(id: string): Promise<ReassignCandidate[]>;
  reassign(id: string, providerId: string, reason: string): Promise<ServiceRequest>;
  cancel(id: string, reason: string): Promise<ServiceRequest>;
  openDispute(id: string, reason: string, category?: DisputeCategory): Promise<ServiceRequest>;
  forceComplete(id: string, reason: string): Promise<ServiceRequest>;
  active(): Promise<ServiceRequest[]>;
  subscribe(listener: RealtimeListener): Unsubscribe;
}
