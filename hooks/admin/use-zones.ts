"use client";

import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";

export function useZones() {
  return useQuery({
    queryKey: ["admin", "zones"],
    queryFn: () => repositories().zones.list(),
    staleTime: 60_000,
  });
}
