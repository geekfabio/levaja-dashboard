"use client";

import { useNow } from "@/hooks/use-now";

export function useClock() {
  return useNow() ?? 0;
}
