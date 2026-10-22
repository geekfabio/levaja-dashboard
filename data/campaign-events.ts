export const CAMPAIGN_EVENT_TYPES = [
  "Entregue",
  "Aberto",
  "Clicou",
  "Devolvido",
  "Falhou",
  "Removeu subscrição",
] as const;

export type CampaignEventType = (typeof CAMPAIGN_EVENT_TYPES)[number];

export const CAMPAIGN_EVENT_TONES: Record<
  CampaignEventType,
  "neutral" | "blue" | "green" | "red" | "amber"
> = {
  Entregue: "neutral",
  Aberto: "blue",
  Clicou: "green",
  Devolvido: "red",
  Falhou: "red",
  "Removeu subscrição": "amber",
};

export type CampaignEvent = {
  id: string;
  campaignId: string;
  contactId: string;
  type: CampaignEventType;
  date: string;
  detail?: string;
};

type EventSeed = [string, CampaignEventType, string, string?];

function events(campaignId: string, seeds: EventSeed[]): CampaignEvent[] {
  return seeds.map(([contactId, type, date, detail], index) => ({
    id: `${campaignId}-ev-${index}`,
    campaignId,
    contactId,
    type,
    date,
    detail,
  }));
}

export const CAMPAIGN_EVENTS: CampaignEvent[] = [
  ...events("cmp-1", [
    ["ct-1", "Entregue", "2026-09-29T09:01"],
    ["ct-1", "Aberto", "2026-09-29T10:14"],
    ["ct-1", "Clicou", "2026-09-29T10:16", "Ver promoções"],
    ["ct-3", "Entregue", "2026-09-29T09:01"],
    ["ct-3", "Aberto", "2026-09-30T08:22"],
    ["ct-6", "Entregue", "2026-09-29T09:02"],
    ["ct-7", "Devolvido", "2026-09-29T09:02", "Permanente — endereço inexistente"],
  ]),
  ...events("cmp-2", [
    ["ct-1", "Entregue", "2026-10-01T08:31"],
    ["ct-1", "Aberto", "2026-10-01T09:05"],
    ["ct-2", "Entregue", "2026-10-01T08:31"],
    ["ct-2", "Aberto", "2026-10-01T12:40"],
    ["ct-2", "Clicou", "2026-10-01T12:41", "Consultar lista de preços"],
    ["ct-3", "Entregue", "2026-10-01T08:31"],
    ["ct-5", "Entregue", "2026-10-01T08:32"],
    ["ct-5", "Aberto", "2026-10-02T07:58"],
    ["ct-6", "Entregue", "2026-10-01T08:32"],
    ["ct-6", "Aberto", "2026-10-01T15:12"],
    ["ct-6", "Clicou", "2026-10-01T15:13", "Consultar lista de preços"],
    ["ct-8", "Devolvido", "2026-10-01T08:32", "Temporária — caixa de correio cheia"],
    ["ct-10", "Entregue", "2026-10-01T08:33"],
  ]),
  ...events("cmp-3", [
    ["ct-1", "Entregue", "2026-10-03T10:00"],
    ["ct-3", "Entregue", "2026-10-03T10:00"],
    ["ct-5", "Entregue", "2026-10-03T10:01"],
    ["ct-6", "Entregue", "2026-10-03T10:01"],
    ["ct-10", "Falhou", "2026-10-03T10:01", "Telefone sem rede há mais de 48 h"],
  ]),
];
