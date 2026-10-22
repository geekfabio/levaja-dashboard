"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { ClientFilters, PageQuery } from "@/data/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function useClientsList(filters: ClientFilters) {
  return useQuery({
    queryKey: ["admin", "clients", "list", filters],
    queryFn: () => repositories().clients.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useClient(id: string) {
  return useQuery({ queryKey: ["admin", "clients", "detail", id], queryFn: () => repositories().clients.get(id) });
}

export function useClientRequests(id: string, query: PageQuery) {
  return useQuery({
    queryKey: ["admin", "clients", "requests", id, query],
    queryFn: () => repositories().clients.requests(id, query),
    placeholderData: keepPreviousData,
  });
}

export function useClientReviews(id: string) {
  return useQuery({ queryKey: ["admin", "clients", "reviews", id], queryFn: () => repositories().clients.reviewsGiven(id) });
}

export function useClientTickets(id: string) {
  return useQuery({ queryKey: ["admin", "clients", "tickets", id], queryFn: () => repositories().clients.tickets(id) });
}

export function useClientBlock(blocked: boolean) {
  return useAdminMutation(
    ({ id, reason }: { id: string; reason: string }) => (blocked ? repositories().clients.block(id, reason) : repositories().clients.unblock(id, reason)),
    { success: blocked ? "Cliente bloqueado" : "Cliente desbloqueado", description: (client) => client.name },
  );
}
