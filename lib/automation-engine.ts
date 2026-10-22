import type { Automation, AutomationStep } from "@/data/automations";
import type { Company } from "@/data/companies";
import { OPEN_OFFER_STATUSES, type DiscountOffer, type OfferStatus } from "@/data/discount-offers";
import type { ProductCategory, Sale } from "@/data/sales";
import { matchesConditions, stepDays } from "./automations";
import { addDays } from "./follow-up";
import { formatDateShort } from "./format";
import type { CampaignEvent } from "@/data/campaign-events";
import type { Contact } from "@/data/contacts";
import { abcBySales, purchaseStats } from "./sales";

export type AutomationEventType =
  | "cliente-criado"
  | "cliente-muda-fase"
  | "fase-alterada"
  | "oportunidade-ganha"
  | "oportunidade-perdida"
  | "campanha-aberta";

export type AutomationEvent = {
  id: string;
  type: AutomationEventType;
  companyId: string;
  date: string;
  stage?: string;
  engagement?: "Aberto" | "Clicou";
};

export type DueStep = {
  key: string;
  automation: Automation;
  company: Company;
  step: AutomationStep;
  stepIndex: number;
  dueDate: string;
  daysWithoutPurchase: number;
  topCategories: ProductCategory[];
  firstStep: boolean;
  lastStep: boolean;
};

type EngineInput = {
  automations: Automation[];
  companies: Company[];
  sales: Sale[];
  events?: AutomationEvent[];
  today: string;
  done: Set<string>;
};

type Enrollment = { key: string; start: string };

function eventMatches(automation: Automation, event: AutomationEvent) {
  const { trigger } = automation;
  if (trigger.type !== event.type) return false;
  if (trigger.type === "fase-alterada") return event.stage === trigger.stage;
  if (trigger.type === "cliente-muda-fase") return event.stage === trigger.clientStage;
  if (trigger.type === "campanha-aberta") return trigger.engagement === "Aberto" || event.engagement === "Clicou";
  return true;
}

function anniversary(customerSince: string, today: string) {
  if (!customerSince || customerSince.slice(0, 4) >= today.slice(0, 4)) return undefined;
  const date = `${today.slice(0, 4)}${customerSince.slice(4)}`;
  return date <= today ? date : undefined;
}

function enrollments(
  automation: Automation,
  company: Company,
  context: { purchase: ReturnType<typeof purchaseStats>; sales: Sale[]; events: AutomationEvent[]; today: string },
): Enrollment[] {
  const { trigger } = automation;
  const activated = automation.activatedAt ?? "0000-00-00";
  const fromActivation = (date: string) => (date < activated ? activated : date);

  switch (trigger.type) {
    case "dias-sem-comprar": {
      const { purchase } = context;
      if (!purchase.lastPurchaseAt || purchase.daysSincePurchase === undefined) return [];
      if (purchase.daysSincePurchase < trigger.days) return [];
      const lastDate = purchase.lastPurchaseAt.slice(0, 10);
      return [{ key: lastDate, start: fromActivation(addDays(lastDate, trigger.days)) }];
    }
    case "divida-vencida": {
      const oldest = context.sales
        .filter((sale) => sale.companyId === company.id && sale.payment === "Crédito" && !sale.paid)
        .sort((a, b) => a.at.localeCompare(b.at))[0];
      if (!oldest) return [];
      const overdueFrom = addDays(oldest.at.slice(0, 10), trigger.days);
      if (overdueFrom > context.today) return [];
      return [{ key: oldest.id, start: fromActivation(overdueFrom) }];
    }
    case "aniversario": {
      const date = anniversary(company.profile?.customerSince ?? "", context.today);
      if (!date || date < activated) return [];
      return [{ key: date.slice(0, 4), start: date }];
    }
    default:
      return context.events
        .filter((event) => event.companyId === company.id && event.date >= activated && eventMatches(automation, event))
        .map((event) => ({ key: event.id, start: event.date }));
  }
}

export function dueSteps({ automations, companies, sales, events = [], today, done }: EngineInput): DueStep[] {
  const running = automations.filter((automation) => automation.status === "Ativa" && automation.steps.length > 0);
  if (running.length === 0) return [];
  const active = companies.filter((company) => !company.archived);
  const abc = abcBySales(active, sales, today);
  const stats = new Map(active.map((company) => [company.id, purchaseStats(sales, company.id, today)]));
  const due: DueStep[] = [];

  for (const automation of running) {
    const days = stepDays(automation.steps);
    for (const company of active) {
      if (!matchesConditions(company, automation.conditions, abc)) continue;
      const purchase = stats.get(company.id)!;
      for (const enrollment of enrollments(automation, company, { purchase, sales, events, today })) {
        automation.steps.forEach((step, index) => {
          const dueDate = addDays(enrollment.start, days[index]);
          if (dueDate > today) return;
          const key = `${automation.id}|${company.id}|${enrollment.key}|${step.id}`;
          if (done.has(key)) return;
          due.push({
            key,
            automation,
            company,
            step,
            stepIndex: index,
            dueDate,
            daysWithoutPurchase: purchase.daysSincePurchase ?? 0,
            topCategories: purchase.topCategories,
            firstStep: index === 0,
            lastStep: index === automation.steps.length - 1,
          });
        });
      }
    }
  }

  return due.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.stepIndex - b.stepIndex);
}

export function offerStatus(offer: DiscountOffer, today: string): OfferStatus {
  if (OPEN_OFFER_STATUSES.includes(offer.status) && offer.validUntil < today) return "Expirada";
  return offer.status;
}

export function isOfferOpen(offer: DiscountOffer, today: string) {
  return OPEN_OFFER_STATUSES.includes(offerStatus(offer, today));
}

export function offerDiscountValue(offer: DiscountOffer, sale: Sale) {
  const base =
    offer.scope === "Toda a encomenda" || offer.categories.length === 0
      ? sale.total
      : sale.lines
          .filter((line) => offer.categories.includes(line.category))
          .reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return Math.round((base * offer.percent) / 100);
}

export function offerScopeLabel(offer: Pick<DiscountOffer, "scope" | "categories">) {
  if (offer.scope === "Toda a encomenda" || offer.categories.length === 0) return "em toda a encomenda";
  return `em ${offer.categories.join(", ")}`;
}

export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

export function daysSince(dateTime: string, today: string) {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dateTime.slice(0, 10)}T00:00:00Z`)) / (24 * 60 * 60 * 1000),
  );
}

export function campaignAutomationEvents(events: CampaignEvent[], contacts: Contact[]): AutomationEvent[] {
  return events
    .filter((event) => event.type === "Aberto" || event.type === "Clicou")
    .flatMap((event) => {
      const contact = contacts.find((item) => item.id === event.contactId);
      return contact
        ? [
            {
              id: event.id,
              type: "campanha-aberta" as const,
              companyId: contact.companyId,
              date: event.date.slice(0, 10),
              engagement: event.type as "Aberto" | "Clicou",
            },
          ]
        : [];
    });
}

export type SimulatedEntry = { company: Company; label: string; sortKey: number };

export type Simulation = {
  mode: "estado" | "aniversario" | "acontecimento";
  entries: SimulatedEntry[];
  withoutHistory: number;
};

const EVENT_LABELS: Record<AutomationEventType, string> = {
  "cliente-criado": "Cliente criado",
  "cliente-muda-fase": "Passou a",
  "fase-alterada": "Oportunidade passou a",
  "oportunidade-ganha": "Oportunidade ganha",
  "oportunidade-perdida": "Oportunidade perdida",
  "campanha-aberta": "Interagiu com campanha",
};

function daysApart(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function simulateTrigger(
  automation: Automation,
  companies: Company[],
  sales: Sale[],
  events: AutomationEvent[],
  today: string,
): Simulation {
  const active = companies.filter((company) => !company.archived);
  const abc = abcBySales(active, sales, today);
  const eligible = active.filter((company) => matchesConditions(company, automation.conditions, abc));
  const { trigger } = automation;
  const entries: SimulatedEntry[] = [];
  let withoutHistory = 0;

  if (trigger.type === "dias-sem-comprar") {
    for (const company of eligible) {
      const { daysSincePurchase } = purchaseStats(sales, company.id, today);
      if (daysSincePurchase === undefined) withoutHistory += 1;
      else if (daysSincePurchase >= trigger.days) {
        entries.push({ company, label: `${daysSincePurchase} dias sem comprar`, sortKey: -daysSincePurchase });
      }
    }
    return { mode: "estado", entries: entries.sort((a, b) => a.sortKey - b.sortKey), withoutHistory };
  }

  if (trigger.type === "divida-vencida") {
    for (const company of eligible) {
      const oldest = sales
        .filter((sale) => sale.companyId === company.id && sale.payment === "Crédito" && !sale.paid)
        .sort((a, b) => a.at.localeCompare(b.at))[0];
      if (!oldest) continue;
      const age = daysApart(oldest.at.slice(0, 10), today);
      if (age >= trigger.days) {
        entries.push({ company, label: `${oldest.document} por pagar há ${age} dias`, sortKey: -age });
      }
    }
    return { mode: "estado", entries: entries.sort((a, b) => a.sortKey - b.sortKey), withoutHistory };
  }

  if (trigger.type === "aniversario") {
    for (const company of eligible) {
      const since = company.profile?.customerSince;
      if (!since) {
        withoutHistory += 1;
        continue;
      }
      let date = `${today.slice(0, 4)}${since.slice(4)}`;
      if (date < today) date = `${Number(today.slice(0, 4)) + 1}${since.slice(4)}`;
      const inDays = daysApart(today, date);
      if (inDays > 30 || Number(date.slice(0, 4)) <= Number(since.slice(0, 4))) continue;
      const years = Number(date.slice(0, 4)) - Number(since.slice(0, 4));
      entries.push({
        company,
        label: `${years} ${years === 1 ? "ano" : "anos"} ${inDays === 0 ? "hoje" : `a ${formatDateShort(date)}`}`,
        sortKey: inDays,
      });
    }
    return { mode: "aniversario", entries: entries.sort((a, b) => a.sortKey - b.sortKey), withoutHistory };
  }

  const recent = events
    .filter((event) => daysApart(event.date, today) <= 30 && eventMatches(automation, event))
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const event of recent) {
    const company = eligible.find((item) => item.id === event.companyId);
    if (!company) continue;
    const detail = event.stage ? ` ${event.stage}` : event.engagement ? ` (${event.engagement === "Clicou" ? "clicou" : "abriu"})` : "";
    entries.push({ company, label: `${EVENT_LABELS[event.type]}${detail} · ${formatDateShort(event.date)}`, sortKey: 0 });
  }
  return { mode: "acontecimento", entries, withoutHistory };
}
