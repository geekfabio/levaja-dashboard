import { create } from "zustand";
import { ACTIVE_STATUSES } from "@/lib/leva-ja/status";
import type { RequestFilters } from "@/data/leva-ja";
import type { PaymentMethodKind, ServiceKind, ServiceStatus } from "@/types/leva-ja";

export const ANY = "all";
export const ACTIVE_FILTER = "active";
export const DISPUTED_FILTER = "disputed";

export type RequestsFilterState = {
  status: ServiceStatus | typeof ANY | typeof ACTIVE_FILTER | typeof DISPUTED_FILTER;
  kind: ServiceKind | typeof ANY;
  zone: string;
  payment: PaymentMethodKind | typeof ANY;
  from: string;
  to: string;
  q: string;
  page: number;
};

export const DEFAULT_REQUEST_FILTERS: RequestsFilterState = {
  status: ANY,
  kind: ANY,
  zone: ANY,
  payment: ANY,
  from: "",
  to: "",
  q: "",
  page: 1,
};

type AdminRequestsState = RequestsFilterState & {
  setFilter: <K extends Exclude<keyof RequestsFilterState, "page">>(key: K, value: RequestsFilterState[K]) => void;
  setPage: (page: number) => void;
  reset: () => void;
};

export const useAdminRequestsStore = create<AdminRequestsState>((set) => ({
  ...DEFAULT_REQUEST_FILTERS,
  setFilter: (key, value) => set({ [key]: value, page: 1 } as Partial<AdminRequestsState>),
  setPage: (page) => set({ page }),
  reset: () => set({ ...DEFAULT_REQUEST_FILTERS }),
}));

export function activeRequestFilterCount(state: RequestsFilterState) {
  return [state.status !== ANY, state.kind !== ANY, state.zone !== ANY, state.payment !== ANY, Boolean(state.from), Boolean(state.to), Boolean(state.q.trim())].filter(Boolean).length;
}

export function toRequestFilters(state: RequestsFilterState, pageSize: number): RequestFilters {
  return {
    status:
      state.status === ACTIVE_FILTER
        ? [...ACTIVE_STATUSES]
        : state.status === ANY || state.status === DISPUTED_FILTER
          ? undefined
          : [state.status],
    disputed: state.status === DISPUTED_FILTER ? true : undefined,
    kind: state.kind === ANY ? undefined : [state.kind],
    zone: state.zone === ANY ? undefined : [state.zone],
    paymentMethod: state.payment === ANY ? undefined : [state.payment],
    from: state.from || undefined,
    to: state.to || undefined,
    q: state.q.trim() || undefined,
    page: state.page,
    pageSize,
  };
}
