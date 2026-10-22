"use client";

import { SALES_ANCHOR } from "@/data/sales";
import { nowLuandaLocal } from "@/lib/format";
import { useNow } from "./use-now";

export function useToday() {
  const now = useNow();
  return now === null ? SALES_ANCHOR.slice(0, 10) : nowLuandaLocal(new Date(now)).slice(0, 10);
}
