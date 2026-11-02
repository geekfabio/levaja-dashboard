"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isRepositoryError } from "@/data/crm";

function createClient() {
  return new QueryClient({
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

export default function CrmProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
