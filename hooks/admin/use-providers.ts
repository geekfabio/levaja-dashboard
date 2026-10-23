"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { PageQuery, ProviderFilters } from "@/data/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useProviderPositions() {
  return useQuery({
    queryKey: ["admin", "map", "positions"],
    queryFn: () => repositories().providers.positions(),
    placeholderData: keepPreviousData,
  });
}

export function useProvidersList(filters: ProviderFilters) {
  return useQuery({
    queryKey: ["admin", "providers", "list", filters],
    queryFn: () => repositories().providers.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useProvider(id: string) {
  return useQuery({
    queryKey: ["admin", "providers", "detail", id],
    queryFn: () => repositories().providers.get(id),
  });
}

export function useProviderTransactions(id: string, query: PageQuery) {
  return useQuery({
    queryKey: ["admin", "providers", "transactions", id, query],
    queryFn: () => repositories().providers.transactions(id, query),
    placeholderData: keepPreviousData,
  });
}

export function useProviderReviews(id: string, query: PageQuery) {
  return useQuery({
    queryKey: ["admin", "providers", "reviews", id, query],
    queryFn: () => repositories().providers.reviews(id, query),
    placeholderData: keepPreviousData,
  });
}

export function useProviderRequests(id: string, query: PageQuery) {
  return useQuery({
    queryKey: ["admin", "providers", "requests", id, query],
    queryFn: () => repositories().providers.requests(id, query),
    placeholderData: keepPreviousData,
  });
}

type StatusAction = "approve" | "suspend" | "reactivate";

const STATUS_FEEDBACK: Record<StatusAction, string> = {
  approve: "Prestador aprovado",
  suspend: "Prestador suspenso",
  reactivate: "Prestador reactivado",
};

export function useProviderStatus(action: StatusAction) {
  return useAdminMutation(
    ({ id, reason }: { id: string; reason: string }) => repositories().providers[action](id, reason),
    { success: STATUS_FEEDBACK[action], description: (provider) => provider.name },
  );
}
