import {
  DEFAULT_CONDITIONS,
  DEFAULT_TRIGGER,
  blankStep,
  type Automation,
  type AutomationStatus,
} from "@/data/automations";
import { automationIssues } from "@/lib/automations";
import { nowLuandaLocal } from "@/lib/format";
import { useAutomationsStore } from "@/stores/automations-store";
import { RepositoryError } from "../repositories/errors";
import type { AutomationsRepository } from "../repositories/automations";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function automations() {
  return useAutomationsStore.getState().automations;
}

function setAutomations(next: Automation[]) {
  useAutomationsStore.setState({ automations: next });
}

export function createMockAutomations(latencyMs: number): AutomationsRepository {
  function find(id: string) {
    const automation = automations().find((item) => item.id === id);
    if (!automation) throw new RepositoryError("not_found", "A automação não existe ou foi removida.");
    return automation;
  }

  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(automations());
    },

    create: async () => {
      await sleep(latencyMs);
      const automation: Automation = {
        id: newId("aut"),
        name: "Nova automação",
        status: "Rascunho",
        trigger: { ...DEFAULT_TRIGGER },
        conditions: { ...DEFAULT_CONDITIONS },
        steps: [blankStep(newId("passo"))],
        enrolled: 0,
        completed: 0,
        updatedAt: today(),
      };
      setAutomations([automation, ...automations()]);
      return structuredClone(automation);
    },

    remove: async (id) => {
      await sleep(latencyMs);
      const automation = find(id);
      if (automation.status !== "Rascunho") {
        throw new RepositoryError("invalid_transition", "Só é possível remover automações em rascunho.");
      }
      setAutomations(automations().filter((item) => item.id !== id));
      return structuredClone(automation);
    },

    setStatus: async (id, status: AutomationStatus) => {
      await sleep(latencyMs);
      const automation = find(id);
      if (status === "Ativa" && automationIssues(automation).length > 0) {
        throw new RepositoryError("validation", "Complete a automação antes de a ativar.");
      }
      if (automation.status === status) return structuredClone(automation);
      const next: Automation = {
        ...automation,
        status,
        updatedAt: today(),
        activatedAt: status === "Ativa" ? nowLuandaLocal().slice(0, 10) : automation.activatedAt,
      };
      setAutomations(automations().map((item) => (item.id === id ? next : item)));
      return structuredClone(next);
    },
  };
}
