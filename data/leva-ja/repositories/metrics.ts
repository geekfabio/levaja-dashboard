import type { ServiceKind, ServiceRequest, ServiceStatus, SosAlert, Withdrawal } from "@/types/leva-ja";
import type { DateRange } from "./common";
import type { DocumentReviewItem } from "./documents";

export type OverviewKpis = {
  requests: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  platformRevenue: number;
  fees: number;
  commissions: number;
  volume: number;
  avgAssignMinutes: number | null;
  providersOnline: number;
  averageRating: number | null;
};

export type DailyRequests = { date: string; total: number; completed: number; cancelled: number; revenue: number };

export type Overview = {
  from: string;
  to: string;
  kpis: OverviewKpis;
  previous: OverviewKpis;
  daily: DailyRequests[];
  byService: { kind: ServiceKind; count: number; volume: number }[];
  funnel: { status: ServiceStatus; count: number }[];
};

export type AttentionItems = {
  stalledSearching: ServiceRequest[];
  openSos: SosAlert[];
  pendingDocuments: DocumentReviewItem[];
  pendingDocumentsTotal: number;
  pendingWithdrawals: Withdrawal[];
  pendingWithdrawalsTotal: number;
};

export interface MetricsRepository {
  overview(range: Required<DateRange>): Promise<Overview>;
  attention(): Promise<AttentionItems>;
}
