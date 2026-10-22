import type { AuditAction, AuditEntityKind, AuditLogEntry } from "@/types/leva-ja";
import type { DateRange, Page, PageQuery } from "./common";

export type AuditFilters = DateRange &
  PageQuery & {
    actorId?: string;
    entityKind?: AuditEntityKind[];
    action?: AuditAction[];
    entityId?: string;
    q?: string;
  };

export interface AuditRepository {
  list(filters?: AuditFilters): Promise<Page<AuditLogEntry>>;
}
