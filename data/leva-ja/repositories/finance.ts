import type { ServiceKind, Transaction, Withdrawal, WithdrawalStatus } from "@/types/leva-ja";
import type { DateRange, Page, PageQuery } from "./common";

export type RevenuePoint = { date: string; fees: number; commissions: number; volume: number; count: number };

export type RevenueByService = { kind: ServiceKind; fees: number; commissions: number; volume: number; count: number };

export type RevenueReport = {
  from: string;
  to: string;
  byDay: RevenuePoint[];
  byService: RevenueByService[];
  totals: { fees: number; commissions: number; revenue: number; volume: number; count: number };
};

export type TransactionRecord = Transaction & { providerId: string; providerName: string; requestId?: string };

export type TransactionFilters = DateRange &
  PageQuery & {
    kind?: Transaction["kind"][];
    status?: Transaction["status"][];
    q?: string;
  };

export type WithdrawalFilters = PageQuery & { status?: WithdrawalStatus[]; q?: string };

export interface FinanceRepository {
  revenue(range: Required<DateRange>): Promise<RevenueReport>;
  withdrawals(filters?: WithdrawalFilters): Promise<Page<Withdrawal>>;
  requestWithdrawal(providerId: string, amount: number): Promise<Withdrawal>;
  approveWithdrawal(id: string): Promise<Withdrawal>;
  rejectWithdrawal(id: string, reason: string): Promise<Withdrawal>;
  markWithdrawalPaid(id: string, paymentReference: string): Promise<Withdrawal>;
  transactions(filters?: TransactionFilters): Promise<Page<TransactionRecord>>;
  exportTransactions(filters?: Omit<TransactionFilters, "page" | "pageSize">): Promise<TransactionRecord[]>;
}
