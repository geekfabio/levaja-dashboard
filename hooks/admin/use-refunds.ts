"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { CreateRefundInput, RefundFilters } from "@/data/leva-ja";
import { formatKz } from "@/lib/format";
import type { Refund } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

const describe = (refund: Refund) => `${refund.code} · ${refund.requestCode} · ${formatKz(refund.amount)}`;

export function useRefunds(filters: RefundFilters) {
  return useQuery({
    queryKey: ["admin", "refunds", "list", filters],
    queryFn: () => repositories().refunds.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useRefundSummary() {
  return useQuery({
    queryKey: ["admin", "refunds", "summary"],
    queryFn: () => repositories().refunds.summary(),
  });
}

export function useRequestRefunds(requestId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "refunds", "request", requestId],
    queryFn: () => repositories().refunds.forRequest(requestId),
    enabled,
  });
}

export function useCreateRefund() {
  return useAdminMutation((input: CreateRefundInput) => repositories().refunds.create(input), { success: "Reembolso pedido", description: describe });
}

export function useApproveRefund() {
  return useAdminMutation(({ id, reason }: { id: string; reason?: string }) => repositories().refunds.approve(id, reason), {
    success: "Reembolso aprovado",
    description: describe,
  });
}

export function useRejectRefund() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().refunds.reject(id, reason), {
    success: "Reembolso rejeitado",
    description: describe,
  });
}

export function useMarkRefundPaid() {
  return useAdminMutation(({ id, reference }: { id: string; reference: string }) => repositories().refunds.markPaid(id, reference), {
    success: "Reembolso marcado como pago",
    description: describe,
  });
}
