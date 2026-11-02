import type { LossReason, Opportunity, OpportunityStage } from "@/data/opportunities";
import type { OpportunitiesRepository, OpportunityDraft, OpportunityPatch } from "../repositories/opportunities";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpOpportunities(http: HttpClient): OpportunitiesRepository {
  return {
    list: () => http.get<Opportunity[]>("/crm/opportunities"),
    get: (opportunityId) => http.get<Opportunity>(`/crm/opportunities/${id(opportunityId)}`),
    create: (draft: OpportunityDraft) => http.post<Opportunity>("/crm/opportunities", draft),
    update: (opportunityId, patch: OpportunityPatch) => http.post<Opportunity>(`/crm/opportunities/${id(opportunityId)}`, patch),
    moveStage: (opportunityId, stage: OpportunityStage, lossReason?: LossReason) => http.post<Opportunity>(`/crm/opportunities/${id(opportunityId)}/stage`, { stage, lossReason }),
  };
}
