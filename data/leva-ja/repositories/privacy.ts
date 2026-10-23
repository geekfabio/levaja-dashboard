import type { PrivacyRequest, PrivacyRequestKind, PrivacyRequestStatus } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type PrivacyFilters = PageQuery & { status?: PrivacyRequestStatus[]; kind?: PrivacyRequestKind[]; q?: string };

export type PrivacySummary = { open: number; dueSoon: number; overdue: number; completedLast30: number };

export type PrivacyExport = { subject: string; generatedAt: string; data: Record<string, unknown> };

export interface PrivacyRepository {
  list(filters?: PrivacyFilters): Promise<Page<PrivacyRequest>>;
  summary(): Promise<PrivacySummary>;
  get(id: string): Promise<PrivacyRequest>;
  start(id: string): Promise<PrivacyRequest>;
  complete(id: string, resolution: string): Promise<PrivacyRequest>;
  reject(id: string, reason: string): Promise<PrivacyRequest>;
  exportData(id: string): Promise<PrivacyExport>;
}
