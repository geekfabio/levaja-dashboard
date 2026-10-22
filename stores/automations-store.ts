import { create } from "zustand";
import {
  AUTOMATIONS,
  DEFAULT_CONDITIONS,
  DEFAULT_TRIGGER,
  DEFAULT_WEEKLY_CAP,
  blankStep,
  type ActionType,
  type Automation,
  type AutomationConditions,
  type AutomationStatus,
  type AutomationStep,
  type Trigger,
} from "@/data/automations";
import { DEFAULT_AUTOMATION_FILTERS, automationIssues } from "@/lib/automations";
import { nowLuandaLocal } from "@/lib/format";
import { recordEvent } from "./audit-store";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export type AutomationsView = "automacoes" | "propostas" | "execucoes";

type AutomationsState = {
  automations: Automation[];
  view: AutomationsView;
  setView: (view: AutomationsView) => void;
  status: string;
  search: string;
  weeklyCap: number;
  editorId: string | null;
  setStatusFilter: (status: string) => void;
  setSearch: (search: string) => void;
  setWeeklyCap: (cap: number) => void;
  openEditor: (id: string) => void;
  closeEditor: () => void;
  createAutomation: () => void;
  removeAutomation: (id: string) => void;
  updateName: (id: string, name: string) => void;
  updateTrigger: (id: string, patch: Partial<Trigger>) => void;
  updateConditions: (id: string, patch: Partial<AutomationConditions>) => void;
  addStep: (id: string, action: ActionType) => void;
  updateStep: (id: string, step: AutomationStep) => void;
  removeStep: (id: string, stepId: string) => void;
  moveStep: (id: string, stepId: string, delta: number) => void;
  setAutomationStatus: (id: string, status: AutomationStatus) => void;
};

export const useAutomationsStore = create<AutomationsState>((set, get) => {
  function edit(id: string, fn: (automation: Automation) => Partial<Automation>) {
    set((state) => ({
      automations: state.automations.map((automation) =>
        automation.id === id && automation.status !== "Ativa"
          ? { ...automation, ...fn(automation), updatedAt: today() }
          : automation,
      ),
    }));
  }

  return {
    automations: AUTOMATIONS,
    view: "automacoes",
    setView: (view) => set({ view, editorId: null }),
    ...DEFAULT_AUTOMATION_FILTERS,
    weeklyCap: DEFAULT_WEEKLY_CAP,
    editorId: null,

    setStatusFilter: (status) => set({ status }),
    setSearch: (search) => set({ search }),
    setWeeklyCap: (weeklyCap) => set({ weeklyCap: Math.max(1, Math.round(weeklyCap)) }),
    openEditor: (editorId) => set({ editorId }),
    closeEditor: () => set({ editorId: null }),

    createAutomation: () => {
      const id = newId("aut");
      const automation: Automation = {
        id,
        name: "Nova automação",
        status: "Rascunho",
        trigger: { ...DEFAULT_TRIGGER },
        conditions: { ...DEFAULT_CONDITIONS },
        steps: [blankStep(newId("passo"))],
        enrolled: 0,
        completed: 0,
        updatedAt: today(),
      };
      set((state) => ({
        automations: [automation, ...state.automations],
        editorId: id,
      }));
    },

    removeAutomation: (id) =>
      set((state) => ({
        automations: state.automations.filter(
          (automation) => automation.id !== id || automation.status !== "Rascunho",
        ),
        editorId: state.editorId === id ? null : state.editorId,
      })),

    updateName: (id, name) => edit(id, () => ({ name })),
    updateTrigger: (id, patch) =>
      edit(id, (automation) => ({ trigger: { ...automation.trigger, ...patch } })),
    updateConditions: (id, patch) =>
      edit(id, (automation) => ({ conditions: { ...automation.conditions, ...patch } })),

    addStep: (id, action) =>
      edit(id, (automation) => ({
        steps: [
          ...automation.steps,
          { ...blankStep(newId("passo"), action), waitDays: automation.steps.length ? 1 : 0 },
        ],
      })),
    updateStep: (id, step) =>
      edit(id, (automation) => ({
        steps: automation.steps.map((item) => (item.id === step.id ? step : item)),
      })),
    removeStep: (id, stepId) =>
      edit(id, (automation) => ({
        steps: automation.steps.filter((item) => item.id !== stepId),
      })),
    moveStep: (id, stepId, delta) =>
      edit(id, (automation) => {
        const steps = [...automation.steps];
        const index = steps.findIndex((item) => item.id === stepId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= steps.length) return {};
        [steps[index], steps[target]] = [steps[target], steps[index]];
        return { steps };
      }),

    setAutomationStatus: (id, status) => {
      const automation = get().automations.find((item) => item.id === id);
      if (!automation) return;
      if (status === "Ativa" && automationIssues(automation).length > 0) return;
      if (automation.status === status) return;
      set((state) => ({
        automations: state.automations.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                updatedAt: today(),
                activatedAt: status === "Ativa" ? nowLuandaLocal().slice(0, 10) : item.activatedAt,
              }
            : item,
        ),
      }));
      recordEvent({
        action: status === "Ativa" ? "ativou a automação" : "pausou a automação",
        target: { module: "Automações", id, label: automation.name },
        sensitive: status === "Ativa",
        changes: [{ field: "Estado", from: automation.status, to: status }],
        toast: {
          title: status === "Ativa" ? "Automação ativada" : "Automação pausada",
          description: automation.name,
          tone: "success",
        },
      });
    },
  };
});
