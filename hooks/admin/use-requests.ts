"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { DisputeCategory } from "@/types/leva-ja";
import type { RequestFilters } from "@/data/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useRequestsList(filters: RequestFilters) {
  return useQuery({
    queryKey: ["admin", "requests", "list", filters],
    queryFn: () => repositories().requests.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useRequest(id: string | null) {
  return useQuery({
    queryKey: ["admin", "requests", "detail", id],
    queryFn: () => repositories().requests.get(id ?? ""),
    enabled: id !== null,
  });
}

export function useActiveRequests() {
  return useQuery({
    queryKey: ["admin", "map", "requests"],
    queryFn: () => repositories().requests.active(),
    placeholderData: keepPreviousData,
  });
}

export function useReassignCandidates(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "requests", "candidates", id],
    queryFn: () => repositories().requests.reassignCandidates(id),
    enabled,
  });
}

export function useCancelRequest() {
  return useAdminMutation(
    ({ id, reason }: { id: string; reason: string }) => repositories().requests.cancel(id, reason),
    { success: (request) => `Pedido ${request.code} cancelado` },
  );
}

export function useReassignRequest() {
  return useAdminMutation(
    ({ id, providerId, reason }: { id: string; providerId: string; reason: string }) =>
      repositories().requests.reassign(id, providerId, reason),
    { success: (request) => `Pedido ${request.code} reatribuído`, description: (request) => request.provider?.name },
  );
}

export function useOpenDispute() {
  return useAdminMutation(
    ({ id, reason, category }: { id: string; reason: string; category?: DisputeCategory }) => repositories().requests.openDispute(id, reason, category),
    { success: (request) => `Disputa aberta em ${request.code}` },
  );
}

export function useForceComplete() {
  return useAdminMutation(
    ({ id, reason }: { id: string; reason: string }) => repositories().requests.forceComplete(id, reason),
    { success: (request) => `Pedido ${request.code} concluído`, description: "A disputa foi fechada com a resolução indicada." },
  );
}
