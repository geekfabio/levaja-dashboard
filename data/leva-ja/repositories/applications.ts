import type { ApplicationStage, ProviderApplication, ProviderDocument } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type ApplicationFilters = PageQuery & { stage?: ApplicationStage[]; zone?: string[]; q?: string };

export type ApplicationFunnel = { stage: ApplicationStage; count: number }[];


export type ApplicationSummary = { funnel: ApplicationFunnel; open: number; approvedLast30: number; rejectedLast30: number; averageDaysToApprove: number | null };

export interface ApplicationsRepository {
  list(filters?: ApplicationFilters): Promise<Page<ProviderApplication>>;
  get(id: string): Promise<ProviderApplication>;
  summary(): Promise<ApplicationSummary>;
  receiveDocument(id: string, icon: ProviderDocument["icon"]): Promise<ProviderApplication>;
  scheduleInterview(id: string, at: string): Promise<ProviderApplication>;
  recordInspection(id: string, passed: boolean, notes: string): Promise<ProviderApplication>;
  advance(id: string, note?: string): Promise<ProviderApplication>;
  approve(id: string, reason: string): Promise<ProviderApplication>;
  reject(id: string, reason: string): Promise<ProviderApplication>;
}
