import type { Claim, ClaimKind, ClaimStatus } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type ClaimFilters = PageQuery & { status?: ClaimStatus[]; kind?: ClaimKind[]; q?: string };

export type ClaimSummary = { open: number; underReview: number; openEstimated: number; paidLast90: number };

export type ReportClaimInput = { requestId: string; kind: ClaimKind; description: string; estimatedAmount: number; occurredAt: string };

export interface ClaimsRepository {
  list(filters?: ClaimFilters): Promise<Page<Claim>>;
  summary(): Promise<ClaimSummary>;
  get(id: string): Promise<Claim>;
  forRequest(requestId: string): Promise<Claim[]>;
  report(input: ReportClaimInput): Promise<Claim>;
  startReview(id: string, insurer: string, policyNumber: string): Promise<Claim>;
  addNote(id: string, text: string): Promise<Claim>;
  approve(id: string, amount: number, reason: string): Promise<Claim>;
  reject(id: string, reason: string): Promise<Claim>;
  markPaid(id: string, paymentReference: string): Promise<Claim>;
}
