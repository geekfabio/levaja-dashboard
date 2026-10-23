"use client";

import { nowLuandaLocal } from "@/lib/format";
import { useNow } from "./use-now";

const FALLBACK_TODAY = "2026-10-11";

export function useToday() {
  const now = useNow();
  return now === null ? FALLBACK_TODAY : nowLuandaLocal(new Date(now)).slice(0, 10);
}
