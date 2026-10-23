"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider, MutationCache, useQueryClient } from "@tanstack/react-query";
import { isRepositoryError, repositories } from "@/data/leva-ja";
import type { RealtimeEvent } from "@/data/leva-ja";
import { useAdminSessionStore } from "@/stores/admin-session-store";

const TOPIC_KEYS: Record<RealtimeEvent["topic"], string[][]> = {
  requests: [["admin", "requests"], ["admin", "map"], ["admin", "metrics"]],
  providers: [["admin", "map"]],
  documents: [["admin", "documents"], ["admin", "metrics"]],
  finance: [["admin", "finance"], ["admin", "metrics"]],
  support: [["admin", "support"], ["admin", "metrics"]],
  audit: [["admin", "audit"]],
};

function handleError(error: unknown) {
  if (isRepositoryError(error) && error.code === "unauthorized") useAdminSessionStore.getState().expire();
}

function createClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => isRepositoryError(error) && error.code === "network" && count < 1,
      },
      mutations: { retry: false },
    },
  });
}

function RealtimeBridge() {
  const client = useQueryClient();

  useEffect(() => {
    const repos = repositories();
    const onEvent = (event: RealtimeEvent) => {
      for (const queryKey of TOPIC_KEYS[event.topic]) client.invalidateQueries({ queryKey });
    };
    const unsubscribers = [repos.requests.subscribe(onEvent), repos.providers.subscribe(onEvent), repos.support.subscribe(onEvent)];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [client]);

  return null;
}

export default function AdminProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);

  return (
    <QueryClientProvider client={client}>
      <RealtimeBridge />
      {children}
    </QueryClientProvider>
  );
}
