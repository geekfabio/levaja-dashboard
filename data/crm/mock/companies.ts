import type { Company } from "@/data/companies";
import { useCompaniesStore } from "@/stores/companies-store";
import { nowLuandaLocal } from "@/lib/format";
import { RepositoryError } from "../repositories/errors";
import type { CompaniesRepository } from "../repositories/companies";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function companies() {
  return useCompaniesStore.getState().companies;
}

function setCompanies(next: Company[]) {
  useCompaniesStore.setState({ companies: next });
}

export function createMockCompanies(latencyMs: number): CompaniesRepository {
  function find(id: string) {
    const company = companies().find((item) => item.id === id);
    if (!company) throw new RepositoryError("not_found", "O cliente não existe ou foi removido.");
    return company;
  }

  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(companies());
    },

    get: async (id) => {
      await sleep(latencyMs);
      return structuredClone(find(id));
    },

    create: async (company) => {
      await sleep(latencyMs);
      if (!company.name.trim()) throw new RepositoryError("validation", "Indique o nome do cliente.", [{ field: "name", message: "Indique o nome do cliente." }]);
      setCompanies([company, ...companies()]);
      return structuredClone(company);
    },

    update: async (id, patch) => {
      await sleep(latencyMs);
      find(id);
      const next = companies().map((item) => (item.id === id ? { ...item, ...patch } : item));
      setCompanies(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    updateMany: async (ids, patch) => {
      await sleep(latencyMs);
      const next = companies().map((item) => (ids.includes(item.id) ? { ...item, ...patch } : item));
      setCompanies(next);
      return structuredClone(next.filter((item) => ids.includes(item.id)));
    },

    scheduleFollowUp: async (id, followUp) => {
      await sleep(latencyMs);
      find(id);
      const next = companies().map((item) => (item.id === id ? { ...item, nextFollowUp: followUp ?? undefined } : item));
      setCompanies(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    updateProfile: async (id, profile) => {
      await sleep(latencyMs);
      find(id);
      const next = companies().map((item) => (item.id === id ? { ...item, profile } : item));
      setCompanies(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    archive: async (ids) => {
      await sleep(latencyMs);
      const next = companies().map((item) => (ids.includes(item.id) ? { ...item, archived: true } : item));
      setCompanies(next);
      return structuredClone(next.filter((item) => ids.includes(item.id)));
    },

    restore: async (snapshot) => {
      await sleep(latencyMs);
      const byId = new Map(snapshot.map((item) => [item.id, item]));
      const next = companies().map((item) => byId.get(item.id) ?? item);
      setCompanies(next);
      return structuredClone(next.filter((item) => byId.has(item.id)));
    },

    registerContact: async (id, date, label) => {
      await sleep(latencyMs);
      const company = companies().find((item) => item.id === id);
      if (!company || date < company.lastInteraction.date) return;
      const today = nowLuandaLocal().slice(0, 10);
      const days = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000));
      setCompanies(companies().map((item) => (item.id === id ? { ...item, lastInteraction: { date, label }, activityDays: days } : item)));
    },

    importCompanies: async (created, updated) => {
      await sleep(latencyMs);
      const updates = new Map(updated);
      const next = [
        ...created,
        ...companies().map((item) => {
          const profile = updates.get(item.id);
          return profile ? { ...item, profile } : item;
        }),
      ];
      setCompanies(next);
      return structuredClone(next);
    },
  };
}
