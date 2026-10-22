"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { DocumentQueueFilters } from "@/data/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useDocumentQueue(filters: DocumentQueueFilters) {
  return useQuery({
    queryKey: ["admin", "documents", "queue", filters],
    queryFn: () => repositories().documents.queue(filters),
    placeholderData: keepPreviousData,
  });
}

export function useExpiringDocuments(withinDays = 30) {
  return useQuery({
    queryKey: ["admin", "documents", "expiring", withinDays],
    queryFn: () => repositories().documents.expiring(withinDays),
  });
}

export function useApproveDocument() {
  return useAdminMutation(
    ({ id, validUntil }: { id: string; validUntil: string }) => repositories().documents.approve(id, validUntil),
    { success: (item) => `${item.document.title} aprovado`, description: (item) => item.providerName },
  );
}

export function useRejectDocument() {
  return useAdminMutation(
    ({ id, reason }: { id: string; reason: string }) => repositories().documents.reject(id, reason),
    { success: (item) => `${item.document.title} recusado`, description: (item) => `${item.providerName} vai ser avisado para enviar de novo.` },
  );
}
