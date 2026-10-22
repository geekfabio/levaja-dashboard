import { create } from "zustand";
import { ACTIVITIES, type Activity, type ActivityType } from "@/data/activities";
import { CURRENT_USER } from "@/data/companies";
import { TASKS, type Task, type TaskStatus } from "@/data/tasks";
import { DEFAULT_FILTERS } from "@/lib/activities";
import { recordEvent } from "./audit-store";
import { useFieldStore } from "./field-store";
import { useCompaniesStore } from "./companies-store";
import { diffRecord } from "@/lib/audit";
import { formatDateShort } from "@/lib/format";

const ACTIVITY_LABELS: Partial<Record<keyof Activity, string>> = {
  type: "Tipo",
  companyName: "Cliente",
  contactName: "Contacto",
  owner: "Gestor",
  zone: "Zona",
  date: "Data",
  note: "Nota",
};

const ACTIVITY_PHRASES: Record<ActivityType, string> = {
  Visita: "registou uma visita a",
  Chamada: "registou uma chamada com",
  "E-mail": "registou um e-mail para",
  Reunião: "registou uma reunião com",
  Entrega: "registou uma entrega a",
  Reclamação: "registou uma reclamação de",
  WhatsApp: "registou uma conversa por WhatsApp com",
};

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
  postponeTask: (id: string, dueDate: string) => void;
  editActivity: (id: string) => void;
  updateActivity: (id: string, patch: Partial<Omit<Activity, "id">>) => void;
  removeActivity: (id: string) => void;
  addActivity: (activity: Activity) => void;
  setNewTaskOpen: (open: boolean) => void;
  addTask: (task: Task) => void;
  moveTaskStatus: (id: string, status: TaskStatus) => void;
};

export const useActivitiesStore = create<ActivitiesState>((set, get) => ({
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
      return {
        calendarMonth: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      };
    }),

  setNewActivityOpen: (newActivityOpen) =>
    set(newActivityOpen ? { newActivityOpen } : { newActivityOpen, editingActivityId: null, prefill: null }),
  editingActivityId: null,
  prefill: null,
  startActivity: (prefill) => set({ prefill, editingActivityId: null, newActivityOpen: true }),
  postponeTask: (id, dueDate) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task) return;
    set((state) => ({
      tasks: state.tasks.map((item) => (item.id === id ? { ...item, dueDate } : item)),
    }));
    recordEvent({
      action: "adiou a tarefa",
      target: { module: "Atividades", id, label: task.title },
      notify: false,
      changes: [{ field: "Prazo", from: formatDateShort(task.dueDate), to: formatDateShort(dueDate) }],
      toast: {
        title: "Tarefa adiada",
        description: `${task.title} · ${formatDateShort(dueDate)}`,
        action: {
          label: "Anular",
          run: () =>
            set((state) => ({
              tasks: state.tasks.map((item) => (item.id === id ? { ...item, dueDate: task.dueDate } : item)),
            })),
        },
      },
    });
  },
  editActivity: (editingActivityId) => set({ editingActivityId, newActivityOpen: true }),
  updateActivity: (id, patch) => {
    const previous = get().activities.find((item) => item.id === id);
    if (!previous) return;
    const next = { ...previous, ...patch };
    const changes = diffRecord(previous, next, ACTIVITY_LABELS, {
      date: (value: string) => formatDateShort(value),
    });
    set((state) => ({
      activities: state.activities.map((item) => (item.id === id ? next : item)),
      newActivityOpen: false,
      editingActivityId: null,
    }));
    if (changes.length === 0) return;
    recordEvent({
      action: "atualizou o registo de atividade de",
      target: { module: "Atividades", id, label: next.companyName },
      companyId: next.companyId,
      notify: false,
      changes,
      toast: {
        title: "Registo atualizado",
        description: `${next.type} · ${next.companyName}`,
        tone: "success",
        action: {
          label: "Anular",
          run: () =>
            set((state) => ({
              activities: state.activities.map((item) => (item.id === id ? previous : item)),
            })),
        },
      },
    });
  },
  removeActivity: (id) => {
    const activities = get().activities;
    const index = activities.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = activities[index];
    set({
      activities: activities.filter((item) => item.id !== id),
      newActivityOpen: false,
      editingActivityId: null,
    });
    recordEvent({
      action: "eliminou o registo de atividade de",
      target: { module: "Atividades", label: removed.companyName },
      companyId: removed.companyId,
      notify: false,
      changes: [{ field: removed.type, from: removed.note }],
      toast: {
        title: "Registo eliminado",
        description: `${removed.type} · ${removed.companyName}`,
        action: {
          label: "Anular",
          run: () =>
            set((state) => ({
              activities: [
                ...state.activities.slice(0, index),
                removed,
                ...state.activities.slice(index),
              ],
            })),
        },
      },
    });
  },
  addActivity: (input) => {
    const field = useFieldStore.getState();
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const checkIn = input.type === "Visita" ? field.todaysCheckIn(input.companyId) : undefined;
    const activity = { ...input, checkIn: input.checkIn ?? checkIn, pendingSync: offline || undefined };
    if (offline) field.enqueue(activity);
    set((state) => ({
      activities: [activity, ...state.activities],
      newActivityOpen: false,
      prefill: null,
    }));
    useCompaniesStore.getState().registerContact(activity.companyId, activity.date, activity.type);
    recordEvent({
      action: ACTIVITY_PHRASES[activity.type],
      target: { module: "Atividades", id: activity.id, label: activity.companyName },
      companyId: activity.companyId,
      toast: {
        title: offline ? "Guardado sem rede" : "Atividade registada",
        description: offline
          ? `${activity.type} · ${activity.companyName}. Fica neste dispositivo e é enviado quando a rede voltar.`
          : `${activity.type} · ${activity.companyName}`,
        tone: "success",
      },
    });
  },

  setNewTaskOpen: (newTaskOpen) => set({ newTaskOpen }),
  addTask: (task) => {
    set((state) => ({
      tasks: [task, ...state.tasks],
      newTaskOpen: false,
    }));
    recordEvent({
      action: "criou a tarefa",
      target: { module: "Atividades", id: task.id, label: task.title },
      notify: task.assignee === CURRENT_USER.name ? false : "update",
      changes: [{ field: "Responsável", to: task.assignee }],
      toast: { title: "Tarefa criada", description: task.title, tone: "success" },
    });
  },
  moveTaskStatus: (id, status) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;
    set((state) => ({
      tasks: state.tasks.map((item) => (item.id === id ? { ...item, status } : item)),
    }));
    recordEvent({
      action: status === "Feita" ? "concluiu a tarefa" : "alterou o estado da tarefa",
      target: { module: "Atividades", id, label: task.title },
      notify: false,
      changes: [{ field: "Estado", from: task.status, to: status }],
    });
  },
}));
