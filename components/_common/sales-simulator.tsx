"use client";

import { useEffect } from "react";
import { useSalesStore } from "@/stores/sales-store";

export default function SalesSimulator() {
  const autoSimulate = useSalesStore((state) => state.autoSimulate);
  const intervalSeconds = useSalesStore((state) => state.intervalSeconds);

  useEffect(() => {
    if (!autoSimulate) return;
    const timer = window.setInterval(() => {
      useSalesStore.getState().simulate(false);
    }, intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoSimulate, intervalSeconds]);

  return null;
}
