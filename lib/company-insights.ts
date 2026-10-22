import type { Activity } from "@/data/activities";
import type { Company, ScoreCard } from "@/data/companies";
import { CLOSED_STATUSES, type Ticket } from "@/data/tickets";
import { formatDateShort } from "./format";

const DAY = 24 * 60 * 60 * 1000;
const BUCKETS = 7;

export const TREND_WINDOW_DAYS: Record<string, number> = {
  "Últimos 7 dias": 7,
  "Últimos 30 dias": 30,
  "Últimos 90 dias": 90,
};

export function activitySummary(activities: Activity[], companyId: string, days: number, today: string) {
  const end = Date.parse(`${today}T00:00:00Z`);
  const start = end - (days - 1) * DAY;
  const inWindow = activities.filter((activity) => {
    if (activity.companyId !== companyId) return false;
    const time = Date.parse(`${activity.date}T00:00:00Z`);
    return time >= start && time <= end;
  });
  const count = (types: Activity["type"][]) =>
    inWindow.filter((activity) => types.includes(activity.type)).length;

  const bucketSize = (days * DAY) / BUCKETS;
  const trend = Array.from({ length: BUCKETS }, (_, index) =>
    inWindow.filter((activity) => {
      const time = Date.parse(`${activity.date}T00:00:00Z`);
      return time >= start + index * bucketSize && time < start + (index + 1) * bucketSize + (index === BUCKETS - 1 ? DAY : 0);
    }).length,
  );

  return {
    total: inWindow.length,
    visits: count(["Visita", "Entrega"]),
    emails: count(["E-mail"]),
    meetings: count(["Reunião"]),
    calls: count(["Chamada", "Reclamação"]),
    trend,
  };
}

function clampStars(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function companyScoreCards(
  company: Company,
  tickets: Ticket[],
  ownerAvatar: string,
): ScoreCard[] {
  const updated = `Atualizado a ${formatDateShort(company.lastInteraction.date)}`;
  const base = { reviewer: company.owner, reviewerAvatar: ownerAvatar, updated };

  const fitStars = clampStars(company.winProbability / 20 + (company.pipelineValue >= 20_000_000 ? 0.5 : 0));
  const relationStars =
    company.activityDays <= 7 ? 5 : company.activityDays <= 30 ? 4 : company.activityDays <= 60 ? 3 : company.activityDays <= 90 ? 2 : 1;

  const open = tickets.filter(
    (ticket) => ticket.companyId === company.id && !CLOSED_STATUSES.includes(ticket.status),
  );
  const severe = open.filter((ticket) => ticket.priority === "Urgente" || ticket.priority === "Alta");
  const serviceStars = open.length === 0 ? 5 : severe.length > 0 ? 2 : 3;

  return [
    {
      ...base,
      title: "Adequação ao negócio",
      description: `Probabilidade de fecho de ${company.winProbability}% e carteira aberta do cliente.`,
      verdict: fitStars >= 4 ? "Potencial elevado" : fitStars === 3 ? "Potencial médio" : "Potencial baixo",
      stars: fitStars,
    },
    {
      ...base,
      title: "Relação e contacto",
      description:
        company.activityDays === 0
          ? "Contactado hoje."
          : `Último contacto há ${company.activityDays} ${company.activityDays === 1 ? "dia" : "dias"} (${company.lastInteraction.label.toLowerCase()}).`,
      verdict: relationStars >= 4 ? "Relação ativa" : relationStars === 3 ? "Precisa de atenção" : "Em risco",
      stars: relationStars,
    },
    {
      ...base,
      title: "Serviço e suporte",
      description:
        open.length === 0
          ? "Sem tickets em aberto."
          : `${open.length} ${open.length === 1 ? "ticket em aberto" : "tickets em aberto"}${severe.length ? `, ${severe.length} de prioridade alta ou urgente` : ""}.`,
      verdict: serviceStars === 5 ? "Sem pendentes" : serviceStars === 3 ? "Em acompanhamento" : "Requer ação",
      stars: serviceStars,
    },
  ];
}
