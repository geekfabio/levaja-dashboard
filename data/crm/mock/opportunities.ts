import { CURRENT_USER } from "@/data/companies";
import { type Opportunity, type OpportunityStage } from "@/data/opportunities";
import { nowLuandaLocal } from "@/lib/format";
import { RepositoryError } from "../repositories/errors";
import type { OpportunitiesRepository, OpportunityDraft, OpportunityPatch } from "../repositories/opportunities";
import type { CrmMockDatabase } from "./database";

function today() {
  return nowLuandaLocal().slice(0, 10);
}

export function createMockOpportunities(db: CrmMockDatabase): OpportunitiesRepository {
  function find(id: string) {
    const opportunity = db.state.opportunities.find((item) => item.id === id);
    if (!opportunity) throw new RepositoryError("not_found", "A oportunidade não existe ou foi removida.");
    return opportunity;
  }

  return {
    list: () => db.run((state) => state.opportunities),

    get: (id) => db.run(() => find(id)),

    create: (draft: OpportunityDraft) =>
      db.run((state) => {
        if (!draft.contactName.trim()) throw new RepositoryError("validation", "Indique o contacto.", [{ field: "contactName", message: "Indique o contacto." }]);
        const opportunity: Opportunity = {
          id: `op-${crypto.randomUUID().slice(0, 8)}`,
          companyId: draft.companyId,
          companyName: draft.companyName,
          contactName: draft.contactName.trim(),
          value: Math.max(0, Math.round(draft.value || 0)),
          stage: draft.stage,
          probability: draft.probability,
          expectedCloseDate: draft.expectedCloseDate || today(),
          owner: draft.owner,
          products: [...draft.products],
          stageHistory: [{ stage: draft.stage, date: today(), author: draft.owner }],
        };
        state.opportunities.unshift(opportunity);
        return opportunity;
      }),

    update: (id, patch: OpportunityPatch) =>
      db.run(() => {
        const opportunity = find(id);
        Object.assign(opportunity, patch);
        return opportunity;
      }),

    moveStage: (id, stage: OpportunityStage, lossReason) =>
      db.run(() => {
        const opportunity = find(id);
        if (stage === "Fechada - Perdida" && !lossReason) throw new RepositoryError("validation", "Indique o motivo da perda.");
        if (opportunity.stage === stage) return opportunity;
        opportunity.stage = stage;
        opportunity.probability = stage === "Fechada - Ganha" ? 100 : stage === "Fechada - Perdida" ? 0 : opportunity.probability;
        opportunity.lossReason = stage === "Fechada - Perdida" ? lossReason : undefined;
        opportunity.stageHistory = [...opportunity.stageHistory, { stage, date: today(), author: CURRENT_USER.name }];
        return opportunity;
      }),
  };
}
