import type { DiscountOffer } from "@/data/discount-offers";
import { buildOffer, supersede } from "@/lib/automation-engine";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { RepositoryError } from "../repositories/errors";
import type { ManualOffer, OffersRepository } from "../repositories/offers";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function offers() {
  return useAutomationRunsStore.getState().offers;
}

function setOffers(next: DiscountOffer[]) {
  useAutomationRunsStore.setState({ offers: next });
}

export function createMockOffers(latencyMs: number): OffersRepository {
  function find(id: string) {
    const offer = offers().find((item) => item.id === id);
    if (!offer) throw new RepositoryError("not_found", "A proposta não existe ou foi removida.");
    return offer;
  }

  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(offers());
    },

    create: async ({ companyId, percent, scope, validDays }: ManualOffer, today: string) => {
      await sleep(latencyMs);
      const company = useCompaniesStore.getState().companies.find((item) => item.id === companyId);
      if (!company) throw new RepositoryError("not_found", "O cliente não existe ou foi removido.");
      const offer = buildOffer(company, percent, scope, validDays, today, "Proposta manual");
      setOffers([offer, ...supersede(offers(), companyId)]);
      return structuredClone(offer);
    },

    setStatus: async (id, status) => {
      await sleep(latencyMs);
      const offer = find(id);
      if (offer.status === status) return structuredClone(offer);
      const next = { ...offer, status };
      setOffers(offers().map((item) => (item.id === id ? next : item)));
      return structuredClone(next);
    },
  };
}
