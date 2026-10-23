import { create } from "zustand";
import type { ProviderFilters } from "@/data/leva-ja";
import type { ServiceKind } from "@/types/leva-ja";

export const ANY = "all";

export type ProvidersFilterState = {
  status: "all" | "online" | "offline" | "suspended" | "pending";
  verified: "all" | "yes" | "no";
  zone: string;
  service: ServiceKind | typeof ANY;
  q: string;
  page: number;
};

export const DEFAULT_PROVIDER_FILTERS: ProvidersFilterState = { status: ANY, verified: ANY, zone: ANY, service: ANY, q: "", page: 1 };

type AdminProvidersState = ProvidersFilterState & {
  setFilter: <K extends Exclude<keyof ProvidersFilterState, "page">>(key: K, value: ProvidersFilterState[K]) => void;
  setPage: (page: number) => void;
  reset: () => void;
};

export const useAdminProvidersStore = create<AdminProvidersState>((set) => ({
  ...DEFAULT_PROVIDER_FILTERS,
  setFilter: (key, value) => set({ [key]: value, page: 1 } as Partial<AdminProvidersState>),
  setPage: (page) => set({ page }),
  reset: () => set({ ...DEFAULT_PROVIDER_FILTERS }),
}));

export function activeProviderFilterCount(state: ProvidersFilterState) {
  return [state.status !== ANY, state.verified !== ANY, state.zone !== ANY, state.service !== ANY, Boolean(state.q.trim())].filter(Boolean).length;
}

export function toProviderFilters(state: ProvidersFilterState, pageSize: number): ProviderFilters {
  return {
    status: state.status === ANY || state.status === "pending" ? undefined : [state.status],
    pendingApproval: state.status === "pending" ? true : undefined,
    verified: state.verified === ANY ? undefined : state.verified === "yes",
    zone: state.zone === ANY ? undefined : [state.zone],
    service: state.service === ANY ? undefined : [state.service],
    q: state.q.trim() || undefined,
    page: state.page,
    pageSize,
  };
}
