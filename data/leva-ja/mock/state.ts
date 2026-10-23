import type {
  AdminSession,
  AdminUser,
  AuditLogEntry,
  CashDeposit,
  Claim,
  Fleet,
  ClientAccount,
  PlatformSettings,
  RolePermissions,
  PricingConfig,
  PayoutBatch,
  Penalty,
  ProviderApplication,
  ProviderAccount,
  Refund,
  ServiceRequest,
  Settlement,
  SosAlert,
  Ticket,
  Withdrawal,
  Zone,
} from "@/types/leva-ja";
import type { TransactionRecord } from "../repositories/finance";

export const MOCK_STATE_VERSION = 6;

export type StoredSettlement = Omit<Settlement, "expected" | "count" | "status">;

export type StoredRequest = Omit<ServiceRequest, "client" | "provider">;

export type MockState = {
  version: number;
  seededAt: string;
  savedAt: string;
  zones: Zone[];
  pricing: PricingConfig;
  settings: PlatformSettings;
  rolePermissions: RolePermissions;
  clients: ClientAccount[];
  providers: ProviderAccount[];
  requests: StoredRequest[];
  transactions: TransactionRecord[];
  withdrawals: Withdrawal[];
  refunds: Refund[];
  settlements: StoredSettlement[];
  cashDeposits: CashDeposit[];
  payoutBatches: PayoutBatch[];
  applications: ProviderApplication[];
  fleets: Fleet[];
  penalties: Penalty[];
  claims: Claim[];
  tickets: Ticket[];
  sos: SosAlert[];
  reviewNotes: Record<string, string>;
  documentSubmittedAt: Record<string, string>;
  adminUsers: AdminUser[];
  audit: AuditLogEntry[];
  sequence: number;
};

export type MockSessionState = { session: AdminSession | null };
