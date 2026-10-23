import type { BusinessAccount, BusinessContract } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type BusinessFilters = PageQuery & { status?: BusinessAccount["status"][]; q?: string };

export type BusinessAmounts = { gross: number; discount: number; net: number; count: number };

export type BusinessStatementStatus = "open" | "due" | "overdue" | "paid";

export type BusinessStatementView = BusinessAmounts & { month: string; dueDate: string; status: BusinessStatementStatus; paidAt?: string; reference?: string };

export type BusinessSummary = Omit<BusinessAccount, "statements"> & {
  members: number;
  currentMonth: BusinessAmounts;
  outstanding: number;
  overdue: number;
  creditUsed: number;
  overLimit: boolean;
};

export type BusinessMember = { id: string; name: string; phone: string; requests30: number };

export type BusinessDetail = BusinessSummary & { memberClients: BusinessMember[]; statements: BusinessStatementView[] };

export type BusinessInput = Pick<BusinessAccount, "name" | "nif" | "sector" | "contactName" | "phone" | "email"> & { contract: BusinessContract };

export interface BusinessRepository {
  list(filters?: BusinessFilters): Promise<Page<BusinessSummary>>;
  get(id: string): Promise<BusinessDetail>;
  candidates(): Promise<BusinessMember[]>;
  create(input: BusinessInput): Promise<BusinessAccount>;
  updateContract(id: string, contract: BusinessContract, reason: string): Promise<BusinessDetail>;
  addMember(id: string, clientId: string): Promise<BusinessDetail>;
  removeMember(id: string, clientId: string, reason: string): Promise<BusinessDetail>;
  markStatementPaid(id: string, month: string, reference: string): Promise<BusinessDetail>;
  setStatus(id: string, status: BusinessAccount["status"], reason: string): Promise<BusinessDetail>;
}
