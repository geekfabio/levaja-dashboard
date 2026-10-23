import type {
  CashDebt,
  CashDeposit,
  Invoice,
  InvoiceKind,
  PaymentMethodKind,
  Settlement,
  SettlementMethod,
  SettlementStatus,
} from "@/types/leva-ja";
import type { DateRange, Page, PageQuery } from "./common";

export type InvoiceFilters = DateRange & PageQuery & { kind?: InvoiceKind[]; method?: PaymentMethodKind[]; q?: string };

export type InvoiceTotals = { invoiced: number; credited: number; vat: number; count: number };

export type InvoicePage = Page<Invoice> & { totals: InvoiceTotals };

export type SettlementFilters = Required<DateRange> & { method?: SettlementMethod[]; status?: SettlementStatus[] };

export type SettlementReport = {
  items: Settlement[];
  totals: { expected: number; received: number; difference: number; open: number };
};

export type CashDebtFilters = PageQuery & { state?: "owing" | "overdue" | "all"; q?: string };

export type CashDebtPage = Page<CashDebt> & { totals: { balance: number; overdueProviders: number; owingProviders: number } };

export interface BillingRepository {
  invoices(filters?: InvoiceFilters): Promise<InvoicePage>;
  exportInvoices(filters?: Omit<InvoiceFilters, "page" | "pageSize">): Promise<Invoice[]>;
  invoice(id: string): Promise<Invoice>;
  settlements(filters: SettlementFilters): Promise<SettlementReport>;
  registerSettlement(id: string, amount: number, reference: string): Promise<Settlement>;
  resolveSettlement(id: string, resolution: string): Promise<Settlement>;
  cashDebts(filters?: CashDebtFilters): Promise<CashDebtPage>;
  cashDeposits(providerId: string): Promise<CashDeposit[]>;
  registerCashDeposit(providerId: string, amount: number, reference: string): Promise<CashDeposit>;
}
