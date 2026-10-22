import {
  ANY,
  BRAND_LOGO,
  VARIABLES,
  type AbcClass,
  type AudienceFilters,
  type BlockType,
  type Campaign,
  type CampaignBlock,
  type CampaignMetrics,
  type Channel,
  type Fallbacks,
  type VariableKey,
} from "@/data/campaigns";
import type { Activity } from "@/data/activities";
import {
  CAMPAIGN_EVENTS,
  type CampaignEvent,
  type CampaignEventType,
} from "@/data/campaign-events";
import { SALES, SALES_ANCHOR, type Sale } from "@/data/sales";
import { abcBySales } from "./sales";
import type { Company } from "@/data/companies";
import type { Contact, ContactabilityStatus } from "@/data/contacts";
import { normalizeAngolanPhone, operatorFor, type Operator } from "./phone";
import {
  OPT_OUT_SUFFIX,
  SMS_PRICE,
  analyzeSms,
  isValidSenderId,
  removeAccents,
} from "./sms";

export type CampaignFilters = {
  channel: string;
  status: string;
  search: string;
};

export const DEFAULT_CAMPAIGN_FILTERS: CampaignFilters = {
  channel: ANY,
  status: ANY,
  search: "",
};

export function filterCampaigns(
  campaigns: Campaign[],
  { channel, status, search }: CampaignFilters,
) {
  const query = search.trim().toLowerCase();
  return campaigns.filter((campaign) => {
    if (channel !== ANY && campaign.channel !== channel) return false;
    if (status !== ANY && campaign.status !== status) return false;
    if (
      query &&
      !campaign.name.toLowerCase().includes(query) &&
      !campaign.subject.toLowerCase().includes(query) &&
      !campaign.smsBody.toLowerCase().includes(query)
    )
      return false;
    return true;
  });
}

export function createBlock(type: BlockType, id: string): CampaignBlock {
  switch (type) {
    case "heading":
      return { id, type, text: "Novo título" };
    case "text":
      return { id, type, text: "" };
    case "banner":
      return { id, type, title: "Destaque", subtitle: "", tone: "brand" };
    case "image":
      return {
        id,
        type,
        src: BRAND_LOGO,
        alt: "Alimenta Angola",
      };
    case "button":
      return { id, type, label: "Saber mais", href: "https://alimentaangola.co.ao" };
    case "divider":
      return { id, type };
  }
}

export type VariableValues = Partial<Record<VariableKey, string>>;

const VARIABLE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export function renderVariables(
  text: string,
  values: VariableValues,
  fallbacks: Fallbacks,
) {
  return text.replace(VARIABLE_PATTERN, (match, key: string) => {
    if (!(key in fallbacks)) return match;
    const variable = key as VariableKey;
    return values[variable]?.trim() || fallbacks[variable];
  });
}

export function valuesForContact(
  contact: Contact | undefined,
  company: Company | undefined,
): VariableValues {
  if (!contact) return {};
  return {
    nome: contact.name.split(" ")[0],
    empresa: contact.companyName,
    gestor: company?.owner,
    zona: company?.zone,
  };
}

export function missingFallbacks(fallbacks: Fallbacks) {
  return VARIABLES.filter((variable) => !fallbacks[variable.key].trim());
}

export function abcClasses(
  companies: Company[],
  sales: Sale[] = SALES,
  today: string = SALES_ANCHOR.slice(0, 10),
): Map<string, AbcClass> {
  return abcBySales(companies, sales, today);
}

export type ExclusionReason =
  | Exclude<ContactabilityStatus, "Válido">
  | "Sem consentimento de e-mail"
  | "Sem consentimento de SMS"
  | "Número inválido";

export const EXCLUSION_TONES: Record<ExclusionReason, "red" | "amber" | "neutral"> = {
  "Sem consentimento de e-mail": "amber",
  "Sem consentimento de SMS": "amber",
  "Número inválido": "red",
  Inválido: "red",
  "Saiu da empresa": "neutral",
  "Pediu remoção": "neutral",
};

export type AudienceEntry = {
  contact: Contact;
  company?: Company;
  phone?: string;
  operator?: Operator;
  reason?: ExclusionReason;
};

export type Audience = {
  companies: Company[];
  eligible: AudienceEntry[];
  excluded: AudienceEntry[];
  exclusionCounts: Partial<Record<ExclusionReason, number>>;
};

function toEntry(
  contact: Contact,
  company: Company | undefined,
  channel: Channel,
): AudienceEntry {
  const entry: AudienceEntry = { contact, company };
  if (contact.contactability !== "Válido") {
    return { ...entry, reason: contact.contactability };
  }
  if (channel === "Email") {
    return contact.consent.email.granted
      ? entry
      : { ...entry, reason: "Sem consentimento de e-mail" };
  }
  const phone = normalizeAngolanPhone(contact.phone);
  const operator = phone ? operatorFor(phone) : null;
  if (!phone || !operator) return { ...entry, reason: "Número inválido" };
  const withPhone = { ...entry, phone, operator };
  return contact.consent.sms.granted
    ? withPhone
    : { ...withPhone, reason: "Sem consentimento de SMS" };
}

export function buildAudience(
  filters: AudienceFilters,
  companies: Company[],
  contacts: Contact[],
  channel: Channel = "Email",
): Audience {
  const abc = abcClasses(companies);
  const minDays = filters.inactiveDays === ANY ? null : Number(filters.inactiveDays);

  const matched = companies.filter((company) => {
    if (filters.zone !== ANY && company.zone !== filters.zone) return false;
    if (
      filters.segment !== ANY &&
      !company.tags.some((tag) => tag === filters.segment)
    )
      return false;
    if (filters.abc !== ANY && abc.get(company.id) !== filters.abc) return false;
    if (minDays !== null && company.activityDays <= minDays) return false;
    return true;
  });

  const byId = new Map(matched.map((company) => [company.id, company]));
  const entries = contacts
    .filter((contact) => byId.has(contact.companyId))
    .map((contact) => toEntry(contact, byId.get(contact.companyId), channel));

  const excluded = entries.filter((entry) => entry.reason);
  const exclusionCounts: Audience["exclusionCounts"] = {};
  for (const entry of excluded) {
    const reason = entry.reason!;
    exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
  }

  return {
    companies: matched,
    eligible: entries.filter((entry) => !entry.reason),
    excluded,
    exclusionCounts,
  };
}

export type ReviewCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export function smsText(campaign: Campaign) {
  return campaign.smsBody + (campaign.smsOptOut ? OPT_OUT_SUFFIX : "");
}

export function reviewChecks(campaign: Campaign, eligibleCount: number): ReviewCheck[] {
  const content: ReviewCheck[] =
    campaign.channel === "SMS"
      ? [
          {
            key: "body",
            label: "Mensagem preenchida",
            ok: campaign.smsBody.trim() !== "",
          },
          {
            key: "sender",
            label: "Remetente válido (3 a 11 caracteres)",
            ok: isValidSenderId(campaign.senderId),
          },
        ]
      : [
          { key: "subject", label: "Assunto preenchido", ok: campaign.subject.trim() !== "" },
          {
            key: "blocks",
            label: "Conteúdo com pelo menos um bloco",
            ok: campaign.blocks.length > 0,
          },
        ];

  return [
    ...content,
    {
      key: "fallbacks",
      label: "Valor por omissão em todas as variáveis",
      ok: missingFallbacks(campaign.fallbacks).length === 0,
    },
    {
      key: "audience",
      label: "Segmento com destinatários elegíveis",
      ok: eligibleCount > 0,
    },
    {
      key: "test",
      label: "Envio de teste registado",
      ok: Boolean(campaign.testSentAt),
    },
  ];
}

export function canSubmitForReview(checks: ReviewCheck[]) {
  return checks.filter((check) => check.key !== "test").every((check) => check.ok);
}

export type OperatorCost = {
  operator: Operator;
  recipients: number;
  messages: number;
  cost: number;
};

export type SmsCostEstimate = {
  byOperator: OperatorCost[];
  messages: number;
  cost: number;
  plainCost: number;
  accentRecipients: number;
};

export function estimateSmsCost(
  entries: AudienceEntry[],
  text: string,
  fallbacks: Fallbacks,
): SmsCostEstimate {
  const totals = new Map<Operator, OperatorCost>();
  let plainCost = 0;
  let accentRecipients = 0;

  for (const entry of entries) {
    if (!entry.operator) continue;
    const rendered = renderVariables(
      text,
      valuesForContact(entry.contact, entry.company),
      fallbacks,
    );
    const analysis = analyzeSms(rendered);
    const current = totals.get(entry.operator) ?? {
      operator: entry.operator,
      recipients: 0,
      messages: 0,
      cost: 0,
    };
    current.recipients += 1;
    current.messages += analysis.messages;
    current.cost += analysis.messages * SMS_PRICE;
    totals.set(entry.operator, current);
    plainCost += analyzeSms(removeAccents(rendered)).messages * SMS_PRICE;
    if (analysis.doubleChars.length > 0) accentRecipients += 1;
  }

  const byOperator = [...totals.values()].sort((a, b) => b.cost - a.cost);
  return {
    byOperator,
    messages: byOperator.reduce((sum, item) => sum + item.messages, 0),
    cost: byOperator.reduce((sum, item) => sum + item.cost, 0),
    plainCost,
    accentRecipients,
  };
}

export type CampaignRates = {
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
};

function share(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

export function campaignRates(metrics: CampaignMetrics): CampaignRates {
  return {
    delivered: share(metrics.delivered, metrics.sent),
    opened: share(metrics.opened, metrics.delivered),
    clicked: share(metrics.clicked, metrics.delivered),
    bounced: share(metrics.hardBounces + metrics.softBounces, metrics.sent),
    unsubscribed: share(metrics.unsubscribed, metrics.delivered),
  };
}

export function eventsForCampaign(campaignId: string) {
  return CAMPAIGN_EVENTS.filter((event) => event.campaignId === campaignId).sort(
    (a, b) => b.date.localeCompare(a.date),
  );
}

export type TimelineItem =
  | {
      kind: "activity";
      id: string;
      date: string;
      activity: Activity;
    }
  | {
      kind: "campaign";
      id: string;
      date: string;
      event: CampaignEvent;
      eventType: CampaignEventType;
      campaign?: Campaign;
      contact?: Contact;
    };

export function clientTimeline(
  companyId: string,
  contacts: Contact[],
  activities: Activity[],
  campaigns: Campaign[],
  limit = 10,
): TimelineItem[] {
  const companyContacts = new Map(
    contacts
      .filter((contact) => contact.companyId === companyId)
      .map((contact) => [contact.id, contact]),
  );

  const campaignItems: TimelineItem[] = CAMPAIGN_EVENTS.filter((event) =>
    companyContacts.has(event.contactId),
  ).map((event) => ({
    kind: "campaign",
    id: event.id,
    date: event.date,
    event,
    eventType: event.type,
    campaign: campaigns.find((campaign) => campaign.id === event.campaignId),
    contact: companyContacts.get(event.contactId),
  }));

  const activityItems: TimelineItem[] = activities
    .filter((activity) => activity.companyId === companyId)
    .map((activity) => ({
      kind: "activity",
      id: activity.id,
      date: `${activity.date}T00:00`,
      activity,
    }));

  return [...campaignItems, ...activityItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
