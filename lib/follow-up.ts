import type { Company } from "@/data/companies";
import { OPEN_OFFER_STATUSES, type DiscountOffer } from "@/data/discount-offers";
import type { FollowUpType } from "@/data/follow-ups";
import type { Opportunity } from "@/data/opportunities";
import type { Sale } from "@/data/sales";
import type { Task } from "@/data/tasks";
import { purchaseStats } from "./sales";

export type FollowUpKind = "agendado" | "tarefa" | "lembrete" | "sem-compras" | "proposta" | "desconto";
export type FollowUpBucket = "atrasado" | "hoje" | "semana" | "sugestao";

export const FOLLOW_UP_KIND_LABELS: Record<FollowUpKind, string> = {
  agendado: "Contacto agendado",
  tarefa: "Tarefa",
  lembrete: "Lembrete",
  "sem-compras": "Sem compras",
  proposta: "Proposta parada",
  desconto: "Proposta de desconto",
};

export const FOLLOW_UP_KIND_TONES: Record<FollowUpKind, "blue" | "purple" | "teal" | "amber" | "orange" | "green"> = {
  agendado: "blue",
  tarefa: "purple",
  lembrete: "teal",
  "sem-compras": "amber",
  proposta: "orange",
  desconto: "green",
};

export const FOLLOW_UP_BUCKETS: { key: FollowUpBucket; label: string; empty: string }[] = [
  { key: "atrasado", label: "Em atraso", empty: "Nada em atraso." },
  { key: "hoje", label: "Hoje", empty: "Nada marcado para hoje." },
  { key: "semana", label: "Próximos 7 dias", empty: "Nada nos próximos 7 dias." },
  { key: "sugestao", label: "Sugestões do CRM", empty: "Sem clientes fora do ritmo nem propostas paradas." },
];

export type FollowUpItem = {
  id: string;
  kind: FollowUpKind;
  bucket: FollowUpBucket;
  due?: string;
  owner: string;
  title: string;
  detail: string;
  companyId?: string;
  taskId?: string;
  opportunityId?: string;
  offerId?: string;
  contactType?: FollowUpType;
};

const DAY = 24 * 60 * 60 * 1000;
const STALE_PROPOSAL_DAYS = 21;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function bucketFor(due: string, today: string): FollowUpBucket | null {
  const diff = daysBetween(today, due);
  if (diff < 0) return "atrasado";
  if (diff === 0) return "hoje";
  if (diff <= 7) return "semana";
  return null;
}

type Sources = {
  companies: Company[];
  tasks: Task[];
  opportunities: Opportunity[];
  sales: Sale[];
  offers: DiscountOffer[];
  today: string;
};

function percentLabel(value: number) {
  return `${value}%`;
}

export function buildFollowUps({ companies, tasks, opportunities, sales, offers, today }: Sources): FollowUpItem[] {
  const active = companies.filter((company) => !company.archived);
  const names = new Map(active.map((company) => [company.id, company.name]));
  const items: FollowUpItem[] = [];
  const openOffers = offers.filter(
    (offer) => OPEN_OFFER_STATUSES.includes(offer.status) && offer.validUntil >= today && names.has(offer.companyId),
  );
  const withOffer = new Set(openOffers.map((offer) => offer.companyId));

  for (const offer of openOffers) {
    const created = offer.createdAt.slice(0, 10);
    const expiresSoon = daysBetween(today, offer.validUntil) <= 2;
    if (offer.status === "Apresentada" && !expiresSoon) continue;
    const scope =
      offer.scope === "Toda a encomenda" || offer.categories.length === 0
        ? "em toda a encomenda"
        : `em ${offer.categories.join(", ")}`;
    items.push({
      id: `desconto-${offer.id}`,
      kind: "desconto",
      bucket: offer.status === "Por apresentar" && created < today ? "atrasado" : "hoje",
      due: offer.status === "Por apresentar" ? created : offer.validUntil,
      owner: offer.owner,
      title: names.get(offer.companyId)!,
      detail:
        offer.status === "Por apresentar"
          ? `Apresentar ${percentLabel(offer.percent)} de desconto ${scope}, válido até ${offer.validUntil.split("-").reverse().slice(0, 2).join("/")}.`
          : `Desconto de ${percentLabel(offer.percent)} apresentado expira ${offer.validUntil === today ? "hoje" : `a ${offer.validUntil.split("-").reverse().slice(0, 2).join("/")}`} — confirmar se vai comprar.`,
      companyId: offer.companyId,
      offerId: offer.id,
      contactType: "Chamada",
    });
  }

  for (const company of active) {
    const followUp = company.nextFollowUp;
    if (followUp) {
      const bucket = bucketFor(followUp.date, today);
      if (bucket) {
        items.push({
          id: `agendado-${company.id}`,
          kind: "agendado",
          bucket,
          due: followUp.date,
          owner: followUp.owner,
          title: company.name,
          detail: `${followUp.type}${followUp.note ? ` · ${followUp.note}` : ""}`,
          companyId: company.id,
          contactType: followUp.type,
        });
      }
      continue;
    }
    if (withOffer.has(company.id)) continue;
    const stats = purchaseStats(sales, company.id, today);
    if (stats.atRisk) {
      items.push({
        id: `sem-compras-${company.id}`,
        kind: "sem-compras",
        bucket: "sugestao",
        owner: company.owner,
        title: company.name,
        detail: `Sem compras há ${stats.daysSincePurchase} dias${stats.usualInterval ? ` (costuma comprar a cada ${stats.usualInterval})` : ""}.`,
        companyId: company.id,
        contactType: "Chamada",
      });
    }
  }

  for (const task of tasks) {
    if (task.status === "Feita") continue;
    const bucket = bucketFor(task.dueDate, today);
    if (bucket) {
      items.push({
        id: `tarefa-${task.id}`,
        kind: "tarefa",
        bucket,
        due: task.dueDate,
        owner: task.assignee,
        title: task.title,
        detail: task.companyName ? `${task.companyName}${task.notes ? ` · ${task.notes}` : ""}` : (task.notes ?? "Sem cliente associado"),
        companyId: task.companyId,
        taskId: task.id,
      });
    } else if (task.reminderDate === today) {
      items.push({
        id: `lembrete-${task.id}`,
        kind: "lembrete",
        bucket: "hoje",
        due: task.dueDate,
        owner: task.assignee,
        title: task.title,
        detail: `Lembrete — prazo a ${task.dueDate.split("-").reverse().slice(0, 2).join("/")}`,
        companyId: task.companyId,
        taskId: task.id,
      });
    }
  }

  for (const opportunity of opportunities) {
    if (opportunity.stage !== "Proposta" && opportunity.stage !== "Negociação") continue;
    if (!names.has(opportunity.companyId)) continue;
    if (active.find((company) => company.id === opportunity.companyId)?.nextFollowUp) continue;
    const lastMove = opportunity.stageHistory[opportunity.stageHistory.length - 1]?.date ?? today;
    const idle = daysBetween(lastMove, today);
    const overdue = opportunity.expectedCloseDate < today;
    if (idle < STALE_PROPOSAL_DAYS && !overdue) continue;
    items.push({
      id: `proposta-${opportunity.id}`,
      kind: "proposta",
      bucket: "sugestao",
      due: opportunity.expectedCloseDate,
      owner: opportunity.owner,
      title: opportunity.companyName,
      detail: overdue
        ? `${opportunity.stage} com data de fecho ultrapassada.`
        : `${opportunity.stage} sem movimento há ${idle} dias.`,
      companyId: opportunity.companyId,
      opportunityId: opportunity.id,
      contactType: "Chamada",
    });
  }

  return items.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

export function followUpDueLabel(due: string | undefined, today: string) {
  if (!due) return "";
  const diff = daysBetween(today, due);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff < 0) return `Há ${-diff} dias`;
  return `Daqui a ${diff} dias`;
}
