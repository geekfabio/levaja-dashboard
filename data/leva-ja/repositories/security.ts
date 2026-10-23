import type { AccessLogEntry, AccessResult, AdminSessionRecord, AdminUser } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type AccessLogFilters = PageQuery & { result?: AccessResult[]; q?: string };

export type SessionView = AdminSessionRecord & { current: boolean };

export interface SecurityRepository {
  sessions(): Promise<SessionView[]>;
  revokeSession(id: string, reason: string): Promise<SessionView[]>;
  accessLog(filters?: AccessLogFilters): Promise<Page<AccessLogEntry>>;
  setTwoFactor(userId: string, enabled: boolean, reason: string): Promise<AdminUser>;
}
