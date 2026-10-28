import {
  BLANK_SMS_TEMPLATE,
  BLANK_TEMPLATE,
  DEFAULT_AUDIENCE,
  DEFAULT_FALLBACKS,
  EMAIL_DEFAULTS,
  SMS_DEFAULTS,
  blocksFromTemplate,
  type Campaign,
  type CampaignStatus,
  type Channel,
} from "@/data/campaigns";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useMessagingStore } from "@/stores/messaging-store";
import { RepositoryError } from "../repositories/errors";
import type { CampaignsRepository } from "../repositories/campaigns";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function luandaNow() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function campaigns() {
  return useCampaignsStore.getState().campaigns;
}

function setCampaigns(next: Campaign[]) {
  useCampaignsStore.setState({ campaigns: next });
}

export function createMockCampaigns(latencyMs: number): CampaignsRepository {
  function find(id: string) {
    const campaign = campaigns().find((item) => item.id === id);
    if (!campaign) throw new RepositoryError("not_found", "A campanha não existe ou foi removida.");
    return campaign;
  }

  function requireStatus(campaign: Campaign, status: CampaignStatus) {
    if (campaign.status !== status) throw new RepositoryError("invalid_transition", `A campanha já não está «${campaign.status}».`);
  }

  function transition(id: string, from: CampaignStatus, patch: Partial<Campaign> & { status: CampaignStatus }) {
    const campaign = find(id);
    requireStatus(campaign, from);
    const next = { ...campaign, ...patch, updatedAt: today() };
    setCampaigns(campaigns().map((item) => (item.id === id ? next : item)));
    return next;
  }

  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(campaigns());
    },

    createFromTemplate: async (channel: Channel, templateId: string) => {
      await sleep(latencyMs);
      const id = newId("cmp");
      const base = { id, channel, status: "Rascunho" as const, fallbacks: { ...DEFAULT_FALLBACKS }, audience: { ...DEFAULT_AUDIENCE }, recipients: 0, updatedAt: today() };
      const settings = useSettingsStore.getState();
      const smsDefaults = { ...SMS_DEFAULTS, senderId: settings.senders.smsSenderId, sendWindow: { start: settings.senders.windowStart, end: settings.senders.windowEnd } };
      let campaign: Campaign;
      if (channel === "SMS") {
        const template = settings.smsTemplates.find((item) => item.id === templateId) ?? BLANK_SMS_TEMPLATE;
        campaign = { ...base, ...EMAIL_DEFAULTS, ...smsDefaults, name: template.id === BLANK_SMS_TEMPLATE.id ? "Nova campanha SMS" : template.name, templateId: template.id, smsBody: template.body };
      } else {
        const template = settings.emailTemplates.find((item) => item.id === templateId) ?? BLANK_TEMPLATE;
        campaign = {
          ...base,
          ...smsDefaults,
          name: template.id === BLANK_TEMPLATE.id ? "Nova campanha" : template.name,
          templateId: template.id,
          subject: template.subject,
          preheader: template.preheader,
          blocks: blocksFromTemplate(template, id),
        };
      }
      setCampaigns([campaign, ...campaigns()]);
      return structuredClone(campaign);
    },

    submitForReview: async (id) => {
      await sleep(latencyMs);
      return structuredClone(transition(id, "Rascunho", { status: "Em revisão" }));
    },

    backToDraft: async (id) => {
      await sleep(latencyMs);
      return structuredClone(transition(id, "Em revisão", { status: "Rascunho", testSentAt: undefined }));
    },

    recordTest: async (id) => {
      await sleep(latencyMs);
      const campaign = find(id);
      requireStatus(campaign, "Em revisão");
      const next = { ...campaign, testSentAt: luandaNow(), updatedAt: today() };
      setCampaigns(campaigns().map((item) => (item.id === id ? next : item)));
      return structuredClone(next);
    },

    schedule: async (id, scheduledAt, recipients, cost) => {
      await sleep(latencyMs);
      const campaign = find(id);
      requireStatus(campaign, "Em revisão");
      if (!campaign.testSentAt) throw new RepositoryError("invalid_transition", "Envie um teste antes de agendar.");
      if (campaign.channel === "SMS" && cost) useMessagingStore.getState().reserve(id, cost);
      return structuredClone(transition(id, "Em revisão", { status: "Agendada", scheduledAt, recipients }));
    },

    cancelSchedule: async (id) => {
      await sleep(latencyMs);
      useMessagingStore.getState().release(id);
      return structuredClone(transition(id, "Agendada", { status: "Em revisão", scheduledAt: undefined }));
    },
  };
}
