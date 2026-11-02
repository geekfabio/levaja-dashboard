import { create } from "zustand";
import { DEFAULT_FILTERS, type SlaFilter } from "@/lib/tickets";

type TicketsState = {
  status: string;
  priority: string;
  assignee: string;
  search: string;
  sla: SlaFilter;
  detailId: string | null;
  detailOpen: boolean;
  newTicketOpen: boolean;
  fromEmailOpen: boolean;
  setStatus: (status: string) => void;
  setPriority: (priority: string) => void;
  setAssignee: (assignee: string) => void;
  setSearch: (search: string) => void;
  setSla: (sla: SlaFilter) => void;
  resetFilters: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setNewTicketOpen: (open: boolean) => void;
  setFromEmailOpen: (open: boolean) => void;
};

export const useTicketsStore = create<TicketsState>((set) => ({
  ...DEFAULT_FILTERS,
  detailId: null,
  detailOpen: false,
  newTicketOpen: false,
  fromEmailOpen: false,

  setStatus: (status) => set({ status }),
  setPriority: (priority) => set({ priority }),
  setAssignee: (assignee) => set({ assignee }),
  setSearch: (search) => set({ search }),
  setSla: (sla) => set({ sla }),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),

  openDetail: (detailId) => set({ detailId, detailOpen: true }),
  closeDetail: () => set({ detailOpen: false }),
  setNewTicketOpen: (newTicketOpen) => set({ newTicketOpen }),
  setFromEmailOpen: (fromEmailOpen) => set({ fromEmailOpen }),
}));
