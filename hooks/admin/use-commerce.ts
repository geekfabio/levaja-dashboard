"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { BroadcastFilters, BroadcastInput, BusinessFilters, BusinessInput, PromotionFilters, PromotionInput, ReportKind } from "@/data/leva-ja";
import { BROADCAST_STATUS_LABELS, PROMOTION_STATUS_LABELS } from "@/lib/leva-ja/commerce";
import type { Broadcast, BusinessAccount, BusinessContract } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useBusinessAccounts(filters: BusinessFilters) {
  return useQuery({ queryKey: ["admin", "business", "list", filters], queryFn: () => repositories().business.list(filters), placeholderData: keepPreviousData });
}

export function useBusinessAccount(id: string | null) {
  return useQuery({ queryKey: ["admin", "business", "detail", id], queryFn: () => repositories().business.get(id ?? ""), enabled: id !== null });
}

export function useBusinessCandidates(enabled: boolean) {
  return useQuery({ queryKey: ["admin", "business", "candidates"], queryFn: () => repositories().business.candidates(), enabled });
}

export function useCreateBusiness() {
  return useAdminMutation((input: BusinessInput) => repositories().business.create(input), { success: (account) => `Conta ${account.name} criada` });
}

export function useUpdateContract() {
  return useAdminMutation(({ id, contract, reason }: { id: string; contract: BusinessContract; reason: string }) => repositories().business.updateContract(id, contract, reason), {
    success: "Contrato actualizado",
    description: (account) => account.name,
  });
}

export function useAddBusinessMember() {
  return useAdminMutation(({ id, clientId }: { id: string; clientId: string }) => repositories().business.addMember(id, clientId), {
    success: "Utilizador acrescentado",
    description: (account) => account.name,
  });
}

export function useRemoveBusinessMember() {
  return useAdminMutation(({ id, clientId, reason }: { id: string; clientId: string; reason: string }) => repositories().business.removeMember(id, clientId, reason), {
    success: "Utilizador retirado",
    description: (account) => account.name,
  });
}

export function useMarkStatementPaid() {
  return useAdminMutation(({ id, month, reference }: { id: string; month: string; reference: string }) => repositories().business.markStatementPaid(id, month, reference), {
    success: "Extracto marcado como pago",
    description: (account) => account.name,
  });
}

export function useSetBusinessStatus() {
  return useAdminMutation(({ id, status, reason }: { id: string; status: BusinessAccount["status"]; reason: string }) => repositories().business.setStatus(id, status, reason), {
    success: (account) => (account.status === "suspended" ? `${account.name} suspensa` : `${account.name} reactivada`),
  });
}

export function usePromotions(filters: PromotionFilters) {
  return useQuery({ queryKey: ["admin", "promotions", "list", filters], queryFn: () => repositories().promotions.list(filters), placeholderData: keepPreviousData });
}

export function usePromotion(id: string | null) {
  return useQuery({ queryKey: ["admin", "promotions", "detail", id], queryFn: () => repositories().promotions.get(id ?? ""), enabled: id !== null });
}

export function useCreatePromotion() {
  return useAdminMutation((input: PromotionInput) => repositories().promotions.create(input), { success: (promotion) => `Promoção ${promotion.code} criada` });
}

export function usePromotionAction() {
  return useAdminMutation(
    ({ id, action, reason }: { id: string; action: "pause" | "resume" | "end"; reason?: string }) =>
      action === "resume" ? repositories().promotions.resume(id) : action === "pause" ? repositories().promotions.pause(id, reason ?? "") : repositories().promotions.end(id, reason ?? ""),
    { success: (promotion) => `${promotion.code}: ${PROMOTION_STATUS_LABELS[promotion.status].toLowerCase()}` },
  );
}

export function useBroadcasts(filters: BroadcastFilters) {
  return useQuery({ queryKey: ["admin", "communications", "list", filters], queryFn: () => repositories().communications.list(filters), placeholderData: keepPreviousData });
}

export function useAudienceEstimate(audience: Broadcast["audience"], enabled: boolean) {
  return useQuery({ queryKey: ["admin", "communications", "estimate", audience], queryFn: () => repositories().communications.estimate(audience), enabled, placeholderData: keepPreviousData });
}

export function useCreateBroadcast() {
  return useAdminMutation((input: BroadcastInput) => repositories().communications.create(input), { success: "Rascunho guardado", description: (broadcast) => broadcast.title });
}

export function useBroadcastAction() {
  return useAdminMutation(
    ({ id, action, at, reason }: { id: string; action: "schedule" | "send" | "cancel"; at?: string; reason?: string }) =>
      action === "send"
        ? repositories().communications.send(id)
        : action === "schedule"
          ? repositories().communications.schedule(id, at ?? "")
          : repositories().communications.cancel(id, reason ?? ""),
    {
      success: (broadcast) => `${broadcast.title}: ${BROADCAST_STATUS_LABELS[broadcast.status].toLowerCase()}`,
      description: (broadcast) => (broadcast.status === "sent" ? "Envio simulado: nenhuma mensagem saiu do painel." : undefined),
    },
  );
}

export function useReport(kind: ReportKind, range: { from: string; to: string }) {
  return useQuery({ queryKey: ["admin", "reports", kind, range], queryFn: () => repositories().reports.run(kind, range), placeholderData: keepPreviousData });
}
