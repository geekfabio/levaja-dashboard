"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { PayoutBatchFilters, TransactionFilters, WithdrawalFilters } from "@/data/leva-ja";
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

export function usePayoutBatches(filters: PayoutBatchFilters) {
  return useQuery({
    queryKey: ["admin", "finance", "batches", filters],
    queryFn: () => repositories().finance.batches(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePayoutBatch(id: string | null) {
  return useQuery({
    queryKey: ["admin", "finance", "batch", id],
    queryFn: () => repositories().finance.batch(id ?? ""),
    enabled: id !== null,
  });
}

export function useCreateBatch() {
  return useAdminMutation((withdrawalIds: string[]) => repositories().finance.createBatch(withdrawalIds), {
    success: (batch) => `Lote ${batch.code} criado`,
    description: (batch) => `${batch.count} levantamento(s) · ${formatKz(batch.total)}`,
  });
}

export function useSendBatch() {
  return useAdminMutation((id: string) => repositories().finance.sendBatch(id), {
    success: (batch) => `Lote ${batch.code} enviado ao banco`,
    description: "O ficheiro de transferências foi descarregado.",
  });
}

export function useMarkBatchPaid() {
  return useAdminMutation(({ id, reference }: { id: string; reference: string }) => repositories().finance.markBatchPaid(id, reference), {
    success: (batch) => `Lote ${batch.code} pago`,
    description: (batch) => `${batch.count} levantamento(s) · ${formatKz(batch.total)}`,
  });
}

export function useCancelBatch() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().finance.cancelBatch(id, reason), {
    success: (batch) => `Lote ${batch.code} cancelado`,
  });
}
