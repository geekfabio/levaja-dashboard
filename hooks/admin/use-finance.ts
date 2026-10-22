"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { TransactionFilters, WithdrawalFilters } from "@/data/leva-ja";
import { formatKz } from "@/lib/format";
import { useAdminMutation } from "./use-admin-mutation";

export function useRevenue(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ["admin", "finance", "revenue", range],
    queryFn: () => repositories().finance.revenue(range),
    placeholderData: keepPreviousData,
  });
}

export function useWithdrawals(filters: WithdrawalFilters) {
  return useQuery({
    queryKey: ["admin", "finance", "withdrawals", filters],
    queryFn: () => repositories().finance.withdrawals(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["admin", "finance", "transactions", filters],
    queryFn: () => repositories().finance.transactions(filters),
    placeholderData: keepPreviousData,
  });
}

export function useApproveWithdrawal() {
  return useAdminMutation((id: string) => repositories().finance.approveWithdrawal(id), {
    success: "Levantamento aprovado",
    description: (withdrawal) => `${withdrawal.providerName} · ${formatKz(withdrawal.amount)}`,
  });
}

export function useRejectWithdrawal() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().finance.rejectWithdrawal(id, reason), {
    success: "Levantamento rejeitado",
    description: (withdrawal) => `${withdrawal.providerName} · ${formatKz(withdrawal.amount)}`,
  });
}

export function useMarkWithdrawalPaid() {
  return useAdminMutation(({ id, reference }: { id: string; reference: string }) => repositories().finance.markWithdrawalPaid(id, reference), {
    success: "Levantamento marcado como pago",
    description: (withdrawal) => `${withdrawal.providerName} · ${formatKz(withdrawal.amount)}`,
  });
}
