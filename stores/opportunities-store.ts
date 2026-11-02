import { create } from "zustand";
import { DEFAULT_FILTERS } from "@/lib/opportunities";

type View = "kanban" | "tabela";

type PendingLossMove = {
  id: string;
};

type OpportunitiesState = {
  owner: string;
  stage: string;
  search: string;
  overdue: boolean;
  view: View;
  detailId: string | null;
  detailOpen: boolean;
  newOpportunityOpen: boolean;
  pendingLossMove: PendingLossMove | null;
  setOwner: (owner: string) => void;
  setStage: (stage: string) => void;
  setSearch: (search: string) => void;
  setOverdue: (overdue: boolean) => void;
  resetFilters: () => void;
  setView: (view: View) => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setNewOpportunityOpen: (open: boolean) => void;
  requestLossMove: (id: string) => void;
  cancelLossMove: () => void;
};

export const useOpportunitiesStore = create<OpportunitiesState>((set) => ({
  ...DEFAULT_FILTERS,
  view: "kanban",
  detailId: null,
  detailOpen: false,
  newOpportunityOpen: false,
  pendingLossMove: null,

  setOwner: (owner) => set({ owner }),
  setStage: (stage) => set({ stage }),
  setSearch: (search) => set({ search }),
  setOverdue: (overdue) => set({ overdue }),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),
  setView: (view) => set({ view }),

  openDetail: (detailId) => set({ detailId, detailOpen: true }),
  closeDetail: () => set({ detailOpen: false }),
  setNewOpportunityOpen: (newOpportunityOpen) => set({ newOpportunityOpen }),

  requestLossMove: (id) => set({ pendingLossMove: { id } }),
  cancelLossMove: () => set({ pendingLossMove: null }),
}));
