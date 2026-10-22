import { create } from "zustand";
import {
  BLANK_SMS_TEMPLATE,
  BLANK_TEMPLATE,
  CAMPAIGNS,
  DEFAULT_AUDIENCE,
  DEFAULT_FALLBACKS,
  EMAIL_DEFAULTS,
  SMS_DEFAULTS,
  blocksFromTemplate,
  type AudienceFilters,
  type BlockType,
  type Campaign,
  type CampaignStatus,
  type CampaignBlock,
  type Channel,
  type VariableKey,
} from "@/data/campaigns";
import { DEFAULT_CAMPAIGN_FILTERS, createBlock } from "@/lib/campaigns";
import { useSettingsStore } from "./settings-store";
import { recordEvent } from "./audit-store";
import { useMessagingStore } from "./messaging-store";
import type { AuditChange } from "@/data/audit";
import { formatDateTime, formatNumber } from "@/lib/format";

export type EditorStep = "conteudo" | "destinatarios" | "revisao" | "resultados";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function luandaNow() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

type CampaignsState = {
  campaigns: Campaign[];
  channel: string;
  status: string;
  search: string;
  editorId: string | null;
  editorStep: EditorStep;
  libraryOpen: boolean;
  setChannel: (channel: string) => void;
  setStatus: (status: string) => void;
  setSearch: (search: string) => void;
  setLibraryOpen: (open: boolean) => void;
  openEditor: (id: string) => void;
  closeEditor: () => void;
  setEditorStep: (step: EditorStep) => void;
  createFromTemplate: (channel: Channel, templateId: string) => void;
  updateDetails: (
    id: string,
    patch: Partial<
      Pick<
        Campaign,
        | "name"
        | "subject"
        | "preheader"
        | "smsBody"
        | "senderId"
        | "smsOptOut"
        | "sendWindow"
      >
    >,
  ) => void;
  addBlock: (id: string, type: BlockType) => void;
  updateBlock: (id: string, block: CampaignBlock) => void;
  removeBlock: (id: string, blockId: string) => void;
  moveBlock: (id: string, blockId: string, delta: number) => void;
  setFallback: (id: string, key: VariableKey, value: string) => void;
  setAudience: (id: string, patch: Partial<AudienceFilters>) => void;
  submitForReview: (id: string) => void;
  backToDraft: (id: string) => void;
  recordTest: (id: string) => void;
  schedule: (id: string, scheduledAt: string, recipients: number, cost?: number) => void;
  cancelSchedule: (id: string) => void;
};

export const useCampaignsStore = create<CampaignsState>((set, get) => {
  function patch(id: string, fn: (campaign: Campaign) => Partial<Campaign>) {
    set((state) => ({
      campaigns: state.campaigns.map((campaign) =>
        campaign.id === id
          ? { ...campaign, ...fn(campaign), updatedAt: today() }
          : campaign,
      ),
    }));
  }

  function transition(
    id: string,
    from: CampaignStatus,
    next: Partial<Campaign> & { status: CampaignStatus },
    action: string,
    changes: AuditChange[] = [],
  ) {
    const campaign = get().campaigns.find((item) => item.id === id);
    if (campaign?.status !== from) return;
    patch(id, () => next);
    recordEvent({
      action,
      target: { module: "Campanhas", id, label: campaign.name },
      sensitive: next.status === "Agendada",
      changes: [{ field: "Estado", from, to: next.status }, ...changes],
      toast:
        next.status === "Agendada"
          ? {
              title: "Campanha agendada",
              description: `${campaign.name} · em modo de teste, nada é enviado a clientes reais.`,
              tone: "success",
            }
          : undefined,
    });
  }

  function editBlocks(
    id: string,
    fn: (blocks: CampaignBlock[]) => CampaignBlock[],
  ) {
    patch(id, (campaign) =>
      campaign.status === "Rascunho" ? { blocks: fn(campaign.blocks) } : {},
    );
  }

  return {
    campaigns: CAMPAIGNS,
    ...DEFAULT_CAMPAIGN_FILTERS,
    editorId: null,
    editorStep: "conteudo",
    libraryOpen: false,

    setChannel: (channel) => set({ channel }),
    setStatus: (status) => set({ status }),
    setSearch: (search) => set({ search }),
    setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
    openEditor: (editorId) => {
      const campaign = get().campaigns.find((item) => item.id === editorId);
      set({
        editorId,
        editorStep: campaign?.status === "Enviada" ? "resultados" : "conteudo",
      });
    },
    closeEditor: () => set({ editorId: null }),
    setEditorStep: (editorStep) => set({ editorStep }),

    createFromTemplate: (channel, templateId) => {
      const id = newId("cmp");
      const base = {
        id,
        channel,
        status: "Rascunho" as const,
        fallbacks: { ...DEFAULT_FALLBACKS },
        audience: { ...DEFAULT_AUDIENCE },
        recipients: 0,
        updatedAt: today(),
      };
      const settings = useSettingsStore.getState();
      const smsDefaults = {
        ...SMS_DEFAULTS,
        senderId: settings.senders.smsSenderId,
        sendWindow: {
          start: settings.senders.windowStart,
          end: settings.senders.windowEnd,
        },
      };
      let campaign: Campaign;

      if (channel === "SMS") {
        const template =
          settings.smsTemplates.find((item) => item.id === templateId) ??
          BLANK_SMS_TEMPLATE;
        campaign = {
          ...base,
          ...EMAIL_DEFAULTS,
          ...smsDefaults,
          name:
            template.id === BLANK_SMS_TEMPLATE.id ? "Nova campanha SMS" : template.name,
          templateId: template.id,
          smsBody: template.body,
        };
      } else {
        const template =
          settings.emailTemplates.find((item) => item.id === templateId) ??
          BLANK_TEMPLATE;
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

      set((state) => ({
        campaigns: [campaign, ...state.campaigns],
        libraryOpen: false,
        editorId: id,
        editorStep: "conteudo",
      }));
    },

    updateDetails: (id, details) =>
      patch(id, (campaign) => (campaign.status === "Rascunho" ? details : {})),

    addBlock: (id, type) =>
      editBlocks(id, (blocks) => [...blocks, createBlock(type, newId(type))]),
    updateBlock: (id, block) =>
      editBlocks(id, (blocks) =>
        blocks.map((item) => (item.id === block.id ? block : item)),
      ),
    removeBlock: (id, blockId) =>
      editBlocks(id, (blocks) => blocks.filter((item) => item.id !== blockId)),
    moveBlock: (id, blockId, delta) =>
      editBlocks(id, (blocks) => {
        const index = blocks.findIndex((item) => item.id === blockId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= blocks.length) return blocks;
        const next = [...blocks];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),

    setFallback: (id, key, value) =>
      patch(id, (campaign) =>
        campaign.status === "Rascunho"
          ? { fallbacks: { ...campaign.fallbacks, [key]: value } }
          : {},
      ),
    setAudience: (id, audience) =>
      patch(id, (campaign) =>
        campaign.status === "Rascunho"
          ? { audience: { ...campaign.audience, ...audience } }
          : {},
      ),

    submitForReview: (id) =>
      transition(id, "Rascunho", { status: "Em revisão" }, "enviou para revisão a campanha"),
    backToDraft: (id) =>
      transition(
        id,
        "Em revisão",
        { status: "Rascunho", testSentAt: undefined },
        "devolveu a rascunho a campanha",
      ),
    recordTest: (id) => {
      const campaign = get().campaigns.find((item) => item.id === id);
      if (campaign?.status !== "Em revisão") return;
      patch(id, () => ({ testSentAt: luandaNow() }));
      recordEvent({
        action: "enviou um teste da campanha",
        target: { module: "Campanhas", id, label: campaign.name },
        notify: false,
        sensitive: true,
      });
    },
    schedule: (id, scheduledAt, recipients, cost) => {
      const campaign = get().campaigns.find((item) => item.id === id);
      if (campaign?.status !== "Em revisão" || !campaign.testSentAt) return;
      if (campaign.channel === "SMS" && cost) useMessagingStore.getState().reserve(id, cost);
      transition(
        id,
        "Em revisão",
        { status: "Agendada", scheduledAt, recipients },
        "agendou a campanha",
        [
          { field: "Envio", to: formatDateTime(scheduledAt) },
          { field: "Destinatários", to: formatNumber(recipients) },
        ],
      );
    },
    cancelSchedule: (id) => {
      useMessagingStore.getState().release(id);
      transition(
        id,
        "Agendada",
        { status: "Em revisão", scheduledAt: undefined },
        "cancelou o agendamento da campanha",
      );
    },
  };
});
