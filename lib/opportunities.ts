import {
  OPPORTUNITY_STAGES,
  type Opportunity,
  type OpportunityStage,
} from "@/data/opportunities";

export const ALL_OWNERS = "all";
export const ANY_STAGE = "any";

export type OpportunityFilters = {
  owner: string;
  stage: string;
  search: string;
  overdue: boolean;
};

export const DEFAULT_FILTERS: OpportunityFilters = {
  owner: ALL_OWNERS,
  stage: ANY_STAGE,
  search: "",
  overdue: false,
};

const CLOSED_STAGES: OpportunityStage[] = ["Fechada - Ganha", "Fechada - Perdida"];

export function isOverdue(opportunity: Opportunity, today: string) {
  return !CLOSED_STAGES.includes(opportunity.stage) && opportunity.expectedCloseDate < today;
}

export function activeFilterCount({ owner, stage, search, overdue }: OpportunityFilters) {
  return [
    owner !== DEFAULT_FILTERS.owner,
    stage !== DEFAULT_FILTERS.stage,
    search.trim() !== "",
    overdue,
  ].filter(Boolean).length;
}

export function filterOpportunities(
  opportunities: Opportunity[],
  { owner, stage, search, overdue }: OpportunityFilters,
  today = "",
): Opportunity[] {
  const query = search.trim().toLowerCase();

  return opportunities.filter((opportunity) => {
    if (overdue && !isOverdue(opportunity, today)) return false;
    if (owner !== ALL_OWNERS && opportunity.owner !== owner) return false;
    if (stage !== ANY_STAGE && opportunity.stage !== stage) return false;
    if (
      query &&
      !opportunity.companyName.toLowerCase().includes(query) &&
      !opportunity.contactName.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export function groupByStage(
  opportunities: Opportunity[],
): Map<OpportunityStage, Opportunity[]> {
  const groups = new Map<OpportunityStage, Opportunity[]>(
    OPPORTUNITY_STAGES.map((stage) => [stage, []]),
  );

  for (const opportunity of opportunities) {
    groups.get(opportunity.stage)?.push(opportunity);
  }

  return groups;
}

export function stageTotal(opportunities: Opportunity[]) {
  return opportunities.reduce((sum, opportunity) => sum + opportunity.value, 0);
}

export function weightedPipeline(opportunities: Opportunity[]) {
  return opportunities.reduce(
    (sum, opportunity) =>
      sum + (opportunity.value * opportunity.probability) / 100,
    0,
  );
}
