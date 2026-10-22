"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";

export function useProviderPositions() {
  return useQuery({
    queryKey: ["admin", "map", "positions"],
    queryFn: () => repositories().providers.positions(),
    placeholderData: keepPreviousData,
  });
}
