"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";

export function useOverview(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ["admin", "metrics", "overview", range],
    queryFn: () => repositories().metrics.overview(range),
    placeholderData: keepPreviousData,
  });
}

export function useAttention() {
  return useQuery({
    queryKey: ["admin", "metrics", "attention"],
    queryFn: () => repositories().metrics.attention(),
  });
}
