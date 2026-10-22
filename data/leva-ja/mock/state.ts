import type {
  AdminSession,
  AdminUser,
  AuditLogEntry,
  ClientAccount,
  PricingConfig,
  ProviderAccount,
  ServiceRequest,
  SosAlert,
  Ticket,
  Withdrawal,
  Zone,
} from "@/types/leva-ja";
import type { TransactionRecord } from "../repositories/finance";

export const MOCK_STATE_VERSION = 1;

export type StoredRequest = Omit<ServiceRequest, "client" | "provider">;

export type MockState = {
  version: number;
  seededAt: string;
  savedAt: string;
  zones: Zone[];
  pricing: PricingConfig;
  clients: ClientAccount[];
  providers: ProviderAccount[];
  requests: StoredRequest[];
  transactions: TransactionRecord[];
  withdrawals: Withdrawal[];
  tickets: Ticket[];
  sos: SosAlert[];
  reviewNotes: Record<string, string>;
  documentSubmittedAt: Record<string, string>;
  adminUsers: AdminUser[];
  audit: AuditLogEntry[];
  sequence: number;
};

export type MockSessionState = { session: AdminSession | null };
