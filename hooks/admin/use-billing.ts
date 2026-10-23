"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { CashDebtFilters, InvoiceFilters, SettlementFilters } from "@/data/leva-ja";
import { formatKz } from "@/lib/format";
import { SETTLEMENT_STATUS_LABELS } from "@/lib/leva-ja/billing";
import { useAdminMutation } from "./use-admin-mutation";

export function useInvoices(filters: InvoiceFilters) {
  return useQuery({
    queryKey: ["admin", "billing", "invoices", filters],
    queryFn: () => repositories().billing.invoices(filters),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ["admin", "billing", "invoice", id],
    queryFn: () => repositories().billing.invoice(id ?? ""),
    enabled: id !== null,
  });
}

export function useSettlements(filters: SettlementFilters) {
  return useQuery({
    queryKey: ["admin", "billing", "settlements", filters],
    queryFn: () => repositories().billing.settlements(filters),
    placeholderData: keepPreviousData,
  });
}

export function useRegisterSettlement() {
  return useAdminMutation(
    ({ id, amount, reference }: { id: string; amount: number; reference: string }) => repositories().billing.registerSettlement(id, amount, reference),
    { success: "Recebimento registado", description: (settlement) => SETTLEMENT_STATUS_LABELS[settlement.status] },
  );
}

export function useResolveSettlement() {
  return useAdminMutation(({ id, resolution }: { id: string; resolution: string }) => repositories().billing.resolveSettlement(id, resolution), {
    success: "Diferença justificada",
  });
}

export function useCashDebts(filters: CashDebtFilters) {
  return useQuery({
    queryKey: ["admin", "billing", "cash", filters],
    queryFn: () => repositories().billing.cashDebts(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCashDeposits(providerId: string | null) {
  return useQuery({
    queryKey: ["admin", "billing", "deposits", providerId],
    queryFn: () => repositories().billing.cashDeposits(providerId ?? ""),
    enabled: providerId !== null,
  });
}

export function useRegisterCashDeposit() {
  return useAdminMutation(
    ({ providerId, amount, reference }: { providerId: string; amount: number; reference: string }) =>
      repositories().billing.registerCashDeposit(providerId, amount, reference),
    { success: "Entrega de numerário registada", description: (deposit) => `${deposit.providerName} · ${formatKz(deposit.amount)}` },
  );
}
