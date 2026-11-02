import { create } from "zustand";
import { ACTIVITIES, type Activity, type ActivityType } from "@/data/activities";
import { TASKS, type Task } from "@/data/tasks";
import { DEFAULT_FILTERS } from "@/lib/activities";

export type ActivitiesView = "lista" | "calendario" | "tarefas" | "rota";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

type ActivitiesState = {
  activities: Activity[];
  tasks: Task[];
  type: string;
  owner: string;
  companyId: string;
  window: string;
  search: string;
  view: ActivitiesView;
  calendarMonth: string;
  newActivityOpen: boolean;
  newTaskOpen: boolean;
  setType: (type: string) => void;
  setOwner: (owner: string) => void;
  setCompanyId: (companyId: string) => void;
  setWindow: (window: string) => void;
  setSearch: (search: string) => void;
  resetFilters: () => void;
  setView: (view: ActivitiesView) => void;
  setCalendarMonth: (month: string) => void;
  shiftCalendarMonth: (delta: number) => void;
  setNewActivityOpen: (open: boolean) => void;
  editingActivityId: string | null;
  prefill: { companyId: string; type: ActivityType; followUpNote?: string } | null;
  startActivity: (prefill: { companyId: string; type: ActivityType; followUpNote?: string }) => void;
  editActivity: (id: string) => void;
  setNewTaskOpen: (open: boolean) => void;
};

export const useActivitiesStore = create<ActivitiesState>((set) => ({
  activities: ACTIVITIES,
  tasks: TASKS,
  ...DEFAULT_FILTERS,
  view: "lista",
  calendarMonth: currentMonth(),
  newActivityOpen: false,
  newTaskOpen: false,

  setType: (type) => set({ type }),
  setOwner: (owner) => set({ owner }),
  setCompanyId: (companyId) => set({ companyId }),
  setWindow: (window) => set({ window }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),
  setView: (view) => set({ view }),
  setCalendarMonth: (calendarMonth) => set({ calendarMonth }),
  shiftCalendarMonth: (delta) =>
    set((state) => {
      const [year, month] = state.calendarMonth.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + delta, 1));
      return { calendarMonth: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` };
    }),

  setNewActivityOpen: (newActivityOpen) => set(newActivityOpen ? { newActivityOpen } : { newActivityOpen, editingActivityId: null, prefill: null }),
  editingActivityId: null,
  prefill: null,
  startActivity: (prefill) => set({ prefill, editingActivityId: null, newActivityOpen: true }),
  editActivity: (editingActivityId) => set({ editingActivityId, newActivityOpen: true }),

  setNewTaskOpen: (newTaskOpen) => set({ newTaskOpen }),
}));
