import { create } from "zustand";
import { COMMISSION_TIERS, DEFAULT_MONTHLY_TARGET, MONTHLY_TARGETS, type CommissionTier } from "@/data/commissions";
import { formatMoney } from "@/lib/format";
import { recordEvent } from "./audit-store";

type CommissionsState = {
  targets: Record<string, number>;
  tiers: CommissionTier[];
  targetFor: (owner: string) => number;
  setTarget: (owner: string, value: number) => void;
  setTierRate: (from: number, rate: number) => void;
};

export const useCommissionsStore = create<CommissionsState>((set, get) => ({
  targets: MONTHLY_TARGETS,
  tiers: COMMISSION_TIERS,
  targetFor: (owner) => get().targets[owner] ?? DEFAULT_MONTHLY_TARGET,
  setTarget: (owner, value) => {
    const previous = get().targetFor(owner);
    const next = Math.max(0, Math.round(value));
    if (previous === next) return;
    set((state) => ({ targets: { ...state.targets, [owner]: next } }));
    recordEvent({
      action: "alterou o objetivo mensal de",
      target: { module: "Definições", label: owner },
      sensitive: true,
      notify: false,
      changes: [{ field: "Objetivo mensal", from: formatMoney(previous), to: formatMoney(next) }],
    });
  },
  setTierRate: (from, rate) =>
    set((state) => ({
      tiers: state.tiers.map((tier) => (tier.from === from ? { ...tier, rate: Math.min(10, Math.max(0, rate)) } : tier)),
    })),
}));
