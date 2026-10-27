import type { LossReason, Opportunity, OpportunityStage } from "@/data/opportunities";

export type OpportunityDraft = Pick<
  Opportunity,
  "companyId" | "companyName" | "contactName" | "value" | "stage" | "probability" | "expectedCloseDate" | "owner" | "products"
>;

export type OpportunityPatch = Partial<Pick<Opportunity, "contactName" | "value" | "probability" | "expectedCloseDate" | "owner">>;

export interface OpportunitiesRepository {
  list(): Promise<Opportunity[]>;
  get(id: string): Promise<Opportunity>;
  create(draft: OpportunityDraft): Promise<Opportunity>;
  update(id: string, patch: OpportunityPatch): Promise<Opportunity>;
  moveStage(id: string, stage: OpportunityStage, lossReason?: LossReason): Promise<Opportunity>;
}
