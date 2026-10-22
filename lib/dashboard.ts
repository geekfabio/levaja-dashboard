import type { Company } from "@/data/companies";
import { MANAGER_FORECAST } from "@/data/forecast";
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from "@/data/opportunities";
import { groupByStage, stageTotal } from "./opportunities";

const CLOSED_WON: OpportunityStage = "Fechada - Ganha";
const CLOSED_LOST: OpportunityStage = "Fechada - Perdida";
const ACTIVE_WINDOW_DAYS = 90;
const AT_RISK_LIMIT = 5;

export function openOpportunities(opportunities: Opportunity[]) {
  return opportunities.filter(
    (opportunity) =>
      opportunity.stage !== CLOSED_WON && opportunity.stage !== CLOSED_LOST,
  );
}

export function wonOpportunities(opportunities: Opportunity[]) {
  return opportunities.filter((opportunity) => opportunity.stage === CLOSED_WON);
}

export function lostOpportunities(opportunities: Opportunity[]) {
  return opportunities.filter((opportunity) => opportunity.stage === CLOSED_LOST);
}

export function conversionRate(opportunities: Opportunity[]) {
  const won = wonOpportunities(opportunities).length;
  const lost = lostOpportunities(opportunities).length;
  const decided = won + lost;
  return decided === 0 ? 0 : Math.round((won / decided) * 100);
}

export function averageDealSize(opportunities: Opportunity[]) {
  const won = wonOpportunities(opportunities);
  if (won.length === 0) return 0;
  return Math.round(stageTotal(won) / won.length);
}

export type StageBreakdown = {
  stage: OpportunityStage;
  count: number;
  value: number;
};

export function pipelineByStage(opportunities: Opportunity[]): StageBreakdown[] {
  const groups = groupByStage(opportunities);
  return OPPORTUNITY_STAGES.map((stage) => {
    const items = groups.get(stage) ?? [];
    return { stage, count: items.length, value: stageTotal(items) };
  });
}

export type ManagerPerformance = {
  name: string;
  avatar: string;
  amount: number;
  quota: number;
};

export function byManager(opportunities: Opportunity[]): ManagerPerformance[] {
  const open = openOpportunities(opportunities);
  return MANAGER_FORECAST.map((manager) => ({
    name: manager.name,
    avatar: manager.avatar,
    amount: stageTotal(open.filter((item) => item.owner === manager.name)),
    quota: manager.quota,
  })).sort((a, b) => b.amount - a.amount);
}

export type AtRiskClient = {
  id: string;
  name: string;
  owner: string;
  activityDays: number;
  pipelineValue: number;
};

export function clientsAtRisk(
  companies: Company[],
  limit = AT_RISK_LIMIT,
): AtRiskClient[] {
  return [...companies]
    .sort((a, b) => b.activityDays - a.activityDays)
    .slice(0, limit)
    .map((company) => ({
      id: company.id,
      name: company.name,
      owner: company.owner,
      activityDays: company.activityDays,
      pipelineValue: company.pipelineValue,
    }));
}

export function scaleTrendTo(
  shape: number[],
  endValue: number,
  startRatio = 0.6,
) {
  const min = Math.min(...shape);
  const max = Math.max(...shape);
  const range = max - min || 1;
  const low = endValue * startRatio;

  return shape.map((point) => low + ((point - min) / range) * (endValue - low));
}

export function activeVsInactive(companies: Company[]) {
  const active = companies.filter(
    (company) => company.activityDays <= ACTIVE_WINDOW_DAYS,
  ).length;
  return { active, inactive: companies.length - active };
}
