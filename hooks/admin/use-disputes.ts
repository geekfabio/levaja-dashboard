"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { DisputeFilters, ResolveDisputeInput } from "@/data/leva-ja";
import { DISPUTE_OUTCOME_LABELS } from "@/lib/leva-ja/refunds";
import type { DisputeCategory } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useDisputes(filters: DisputeFilters) {
  return useQuery({
    queryKey: ["admin", "disputes", "list", filters],
    queryFn: () => repositories().disputes.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useDisputeSummary() {
  return useQuery({
    queryKey: ["admin", "disputes", "summary"],
    queryFn: () => repositories().disputes.summary(),
  });
}

export function useAddDisputeNote() {
  return useAdminMutation(({ requestId, text }: { requestId: string; text: string }) => repositories().disputes.addNote(requestId, text), {
    success: "Nota acrescentada",
    description: (request) => request.code,
  });
}

export function useSetDisputeCategory() {
  return useAdminMutation(
    ({ requestId, category }: { requestId: string; category: DisputeCategory }) => repositories().disputes.setCategory(requestId, category),
    { success: "Categoria alterada", description: (request) => request.code },
  );
}

export function useResolveDispute() {
  return useAdminMutation(
    ({ requestId, input }: { requestId: string; input: ResolveDisputeInput }) => repositories().disputes.resolve(requestId, input),
    {
      success: (request) => `Disputa de ${request.code} resolvida`,
      description: (request) => (request.dispute?.outcome ? DISPUTE_OUTCOME_LABELS[request.dispute.outcome] : undefined),
    },
  );
}
