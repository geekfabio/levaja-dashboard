import type { Refund, RefundSource, RefundStatus } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type RefundFilters = PageQuery & { status?: RefundStatus[]; source?: RefundSource[]; q?: string };

export type RefundSummary = { pendingAmount: number; pendingCount: number; approvedAmount: number; paidLast30: number };

export type RequestRefunds = { refunds: Refund[]; refundable: number; paidAt?: string };

export type CreateRefundInput = { requestId: string; amount: number; reason: string; chargeProvider: boolean };

export interface RefundsRepository {
  list(filters?: RefundFilters): Promise<Page<Refund>>;
  summary(): Promise<RefundSummary>;
  forRequest(requestId: string): Promise<RequestRefunds>;
  create(input: CreateRefundInput): Promise<Refund>;
  approve(id: string, reason?: string): Promise<Refund>;
  reject(id: string, reason: string): Promise<Refund>;
  markPaid(id: string, paymentReference: string): Promise<Refund>;
}
