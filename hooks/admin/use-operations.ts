"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { ClaimFilters, HeatmapQuery, ReportClaimInput, ScheduledFilters } from "@/data/leva-ja";
import { formatKz } from "@/lib/format";
import { CLAIM_STATUS_LABELS } from "@/lib/leva-ja/scheduling";
import type { Claim } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

const describeClaim = (claim: Claim) => `${claim.code} · ${CLAIM_STATUS_LABELS[claim.status]}${claim.approvedAmount ? ` · ${formatKz(claim.approvedAmount)}` : ""}`;

export function useScheduled(filters: ScheduledFilters) {
  return useQuery({ queryKey: ["admin", "operations", "scheduled", filters], queryFn: () => repositories().operations.scheduled(filters), placeholderData: keepPreviousData });
}

export function useSla(range: { from: string; to: string }) {
  return useQuery({ queryKey: ["admin", "operations", "sla", range], queryFn: () => repositories().operations.sla(range), placeholderData: keepPreviousData });
}

export function useHeatmap(query: HeatmapQuery, enabled: boolean) {
  return useQuery({ queryKey: ["admin", "operations", "heatmap", query], queryFn: () => repositories().operations.heatmap(query), placeholderData: keepPreviousData, enabled });
}

export function useClaims(filters: ClaimFilters) {
  return useQuery({ queryKey: ["admin", "claims", "list", filters], queryFn: () => repositories().claims.list(filters), placeholderData: keepPreviousData });
}

export function useClaimSummary() {
  return useQuery({ queryKey: ["admin", "claims", "summary"], queryFn: () => repositories().claims.summary() });
}

export function useClaim(id: string | null) {
  return useQuery({ queryKey: ["admin", "claims", "detail", id], queryFn: () => repositories().claims.get(id ?? ""), enabled: id !== null });
}

export function useRequestClaims(requestId: string, enabled: boolean) {
  return useQuery({ queryKey: ["admin", "claims", "request", requestId], queryFn: () => repositories().claims.forRequest(requestId), enabled });
}

export function useReportClaim() {
  return useAdminMutation((input: ReportClaimInput) => repositories().claims.report(input), { success: "Sinistro participado", description: describeClaim });
}

export function useStartClaimReview() {
  return useAdminMutation(({ id, insurer, policyNumber }: { id: string; insurer: string; policyNumber: string }) => repositories().claims.startReview(id, insurer, policyNumber), {
    success: "Sinistro em análise",
    description: describeClaim,
  });
}

export function useAddClaimNote() {
  return useAdminMutation(({ id, text }: { id: string; text: string }) => repositories().claims.addNote(id, text), { success: "Nota acrescentada", description: describeClaim });
}

export function useApproveClaim() {
  return useAdminMutation(({ id, amount, reason }: { id: string; amount: number; reason: string }) => repositories().claims.approve(id, amount, reason), {
    success: "Sinistro aprovado",
    description: describeClaim,
  });
}

export function useRejectClaim() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().claims.reject(id, reason), { success: "Sinistro recusado", description: describeClaim });
}

export function useMarkClaimPaid() {
  return useAdminMutation(({ id, reference }: { id: string; reference: string }) => repositories().claims.markPaid(id, reference), {
    success: "Indemnização registada como paga",
    description: describeClaim,
  });
}
