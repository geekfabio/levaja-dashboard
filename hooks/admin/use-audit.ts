"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { AuditFilters } from "@/data/leva-ja";

export function useAuditLog(filters: AuditFilters, enabled = true) {
  return useQuery({
    queryKey: ["admin", "audit", filters],
    queryFn: () => repositories().audit.list(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}
