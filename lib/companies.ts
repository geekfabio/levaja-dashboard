import type { Company, SortKey } from "@/data/companies";
import { formatDateShort, formatMoney } from "@/lib/format";

export { formatMoney };
export const formatDate = formatDateShort;

export type CompanyFilters = {
  sortBy: SortKey;
  owner: string;
  stage: string;
  activityWindow: number;
  zone: string;
  team: string;
};

export const TODAY = "2026-09-14";

export const ALL_OWNERS = "all";
export const ANY_STAGE = "any";
export const ANY_ZONE = "any";
export const ALL_TEAMS = "all";

export const DEFAULT_FILTERS: CompanyFilters = {
  sortBy: "pipelineValue",
  owner: ALL_OWNERS,
  stage: ANY_STAGE,
  activityWindow: 90,
  zone: ANY_ZONE,
  team: ALL_TEAMS,
};

export function activeFilterCount({
  owner,
  stage,
  activityWindow,
  zone,
  team,
}: CompanyFilters) {
  return [
    owner !== DEFAULT_FILTERS.owner,
    stage !== DEFAULT_FILTERS.stage,
    activityWindow !== DEFAULT_FILTERS.activityWindow,
    zone !== DEFAULT_FILTERS.zone,
    team !== DEFAULT_FILTERS.team,
  ].filter(Boolean).length;
}

const TAG_CHAR_BUDGET = 20;

export function filterCompanies(
  companies: Company[],
  { sortBy, owner, stage, activityWindow, zone, team }: CompanyFilters,
  memberships: Record<string, string> = {},
): Company[] {
  const filtered = companies.filter((company) => {
    if (company.archived) return false;
    if (owner !== ALL_OWNERS && company.owner !== owner) return false;
    if (zone !== ANY_ZONE && company.zone !== zone) return false;
    if (team !== ALL_TEAMS && memberships[company.owner] !== team) return false;
    if (stage !== ANY_STAGE && !company.tags.some((tag) => tag === stage)) {
      return false;
    }
    return company.activityDays <= activityWindow;
  });

  return filtered.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "lastInteraction":
        return b.lastInteraction.date.localeCompare(a.lastInteraction.date);
      case "openDeals":
        return b.openDeals - a.openDeals;
      case "winProbability":
        return b.winProbability - a.winProbability;
      default:
        return b.pipelineValue - a.pipelineValue;
    }
  });
}

export function companiesCsvRows(companies: Company[]) {
  return [
    [
      "Cliente",
      "Segmento e Fase",
      "Gestor de Conta",
      "Oportunidades Abertas",
      "Valor em Carteira",
      "Probabilidade de Fecho (%)",
      "Data do Último Contacto",
      "Último Contacto",
      "NIF",
      "Zona",
      "Telefone",
      "E-mail",
      "Morada",
      "Município",
      "Condições",
      "Limite de crédito",
    ],
    ...companies.map((company) => [
      company.name,
      company.tags.join("; "),
      company.owner,
      company.openDeals,
      company.pipelineValue,
      company.winProbability,
      company.lastInteraction.date,
      company.lastInteraction.label,
      company.profile?.nif ?? "",
      company.zone,
      company.profile?.phone ?? "",
      company.profile?.billingEmail ?? "",
      company.profile?.address ?? "",
      company.profile?.municipality ?? "",
      company.profile?.paymentTerms ?? "",
      company.profile?.creditLimit ?? 0,
    ]),
  ];
}

export function splitTags(tags: Company["tags"]) {
  let used = 0;
  const visible: Company["tags"] = [];

  for (const tag of tags) {
    if (visible.length === 2 || used + tag.length > TAG_CHAR_BUDGET) break;
    visible.push(tag);
    used += tag.length;
  }

  if (visible.length === 0 && tags.length > 0) visible.push(tags[0]);

  return { visible, hidden: tags.length - visible.length };
}

export function companyHealth(company: Company) {
  return {
    discovery: Math.round(company.winProbability * 0.372),
    evaluation: Math.round(company.winProbability * 0.651),
    procurement: Math.round(company.winProbability * 0.372),
  };
}

export function companyActivity(company: Company) {
  const deals = company.openDeals;
  return {
    total: deals * 15,
    touches: deals * 4,
    emails: deals + 4,
    meetings: Math.ceil(deals / 2),
    calls: deals + 1,
  };
}

export function daysSince(iso: string) {
  const day = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(iso)) / day));
}

export function companyTotals(companies: Company[]) {
  const pipeline = companies.reduce((sum, company) => sum + company.pipelineValue, 0);
  const deals = companies.reduce((sum, company) => sum + company.openDeals, 0);
  const probability = companies.length
    ? Math.round(companies.reduce((sum, company) => sum + company.winProbability, 0) / companies.length)
    : 0;
  const weighted = companies.reduce(
    (sum, company) => sum + (company.pipelineValue * company.winProbability) / 100,
    0,
  );
  const inactive = companies.filter((company) => company.activityDays > 30).length;
  return { pipeline, deals, probability, weighted, inactive };
}
