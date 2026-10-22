"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { PageQuery, TicketFilters } from "@/data/leva-ja";
import type { SosStatus } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useTickets(filters: TicketFilters) {
  return useQuery({
    queryKey: ["admin", "support", "tickets", filters],
    queryFn: () => repositories().support.tickets(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: ["admin", "support", "ticket", id],
    queryFn: () => repositories().support.ticket(id ?? ""),
    enabled: id !== null,
  });
}

export function useAssignees(enabled: boolean) {
  return useQuery({ queryKey: ["admin", "support", "assignees"], queryFn: () => repositories().support.assignees(), enabled, staleTime: 60_000 });
}

export function useSosAlerts(status?: SosStatus[]) {
  return useQuery({
    queryKey: ["admin", "support", "sos", status ?? "all"],
    queryFn: () => repositories().support.sosAlerts(status),
    refetchInterval: 20_000,
  });
}

export function useLowRatings(query: PageQuery & { handled?: boolean }) {
  return useQuery({
    queryKey: ["admin", "support", "low-ratings", query],
    queryFn: () => repositories().support.lowRatings(query),
    placeholderData: keepPreviousData,
  });
}

export function useAssignTicket() {
  return useAdminMutation(({ id, adminId }: { id: string; adminId: string }) => repositories().support.assignTicket(id, adminId), {
    success: (ticket) => `${ticket.code} atribuída`,
    description: (ticket) => ticket.assigneeName,
  });
}

export function useReplyTicket() {
  return useAdminMutation(({ id, body }: { id: string; body: string }) => repositories().support.replyTicket(id, body), {
    success: (ticket) => `Resposta enviada em ${ticket.code}`,
  });
}

export function useResolveTicket() {
  return useAdminMutation(({ id, resolution }: { id: string; resolution: string }) => repositories().support.resolveTicket(id, resolution), {
    success: (ticket) => `${ticket.code} resolvida`,
  });
}

export function useAcknowledgeSos() {
  return useAdminMutation((id: string) => repositories().support.acknowledgeSos(id), {
    success: (alert) => `SOS ${alert.requestCode} em acompanhamento`,
    description: (alert) => alert.raisedByName,
  });
}

export function useResolveSos() {
  return useAdminMutation(({ id, resolution }: { id: string; resolution: string }) => repositories().support.resolveSos(id, resolution), {
    success: (alert) => `SOS ${alert.requestCode} resolvido`,
  });
}

export function useMarkReviewHandled() {
  return useAdminMutation(({ id, note }: { id: string; note: string }) => repositories().support.markReviewHandled(id, note), {
    success: "Avaliação revista",
    description: (item) => item.requestCode,
  });
}
