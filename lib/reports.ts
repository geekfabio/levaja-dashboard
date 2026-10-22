import type { Company } from "@/data/companies";
import type { Opportunity } from "@/data/opportunities";
import type { TeamSetting, ZoneSetting } from "@/data/settings";
import type { RankedItem } from "@/components/_common/ranked-bar-list";
import { openOpportunities, type AtRiskClient } from "./dashboard";
import { stageTotal } from "./opportunities";
import type { CsvCell } from "./csv";

export const REPORT_DIMENSIONS = ["gestor", "zona", "equipa"] as const;

export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

export function byZoneLive(
  opportunities: Opportunity[],
  companies: Company[],
  zones: ZoneSetting[],
): RankedItem[] {
  const open = openOpportunities(opportunities);
  const zoneOf = new Map(companies.map((company) => [company.id, company.zone]));
  return zones
    .map((zone) => ({
      key: zone.name,
      label: zone.name,
      amount: stageTotal(open.filter((item) => zoneOf.get(item.companyId) === zone.name)),
      quota: Math.max(zone.quota, 1),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function byTeam(
  opportunities: Opportunity[],
  teams: TeamSetting[],
  memberships: Record<string, string>,
): RankedItem[] {
  const open = openOpportunities(opportunities);
  return teams
    .map((team) => ({
      key: team.id,
      label: team.name,
      amount: stageTotal(open.filter((item) => memberships[item.owner] === team.id)),
      quota: Math.max(team.quota, 1),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function atRiskClients(
  companies: Company[],
  windowDays: number,
): AtRiskClient[] {
  return companies
    .filter((company) => company.activityDays > windowDays)
    .sort((a, b) => b.activityDays - a.activityDays)
    .map((company) => ({
      id: company.id,
      name: company.name,
      owner: company.owner,
      activityDays: company.activityDays,
      pipelineValue: company.pipelineValue,
    }));
}

export function performanceCsvRows(
  dimensionLabel: string,
  items: RankedItem[],
): CsvCell[][] {
  return [
    [dimensionLabel, "Carteira Aberta (Kz)", "Quota (Kz)", "% da Quota"],
    ...items.map((item) => [
      item.label,
      item.amount,
      item.quota,
      Math.round((item.amount / item.quota) * 100),
    ]),
  ];
}

export function atRiskCsvRows(clients: AtRiskClient[]): CsvCell[][] {
  return [
    ["Cliente", "Gestor", "Dias sem Atividade", "Valor em Carteira (Kz)"],
    ...clients.map((client) => [
      client.name,
      client.owner,
      client.activityDays,
      client.pipelineValue,
    ]),
  ];
}
