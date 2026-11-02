"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { Campaign, Channel } from "@/data/campaigns";
import { formatDateTime, formatNumber } from "@/lib/format";
import { recordEvent } from "@/stores/audit-store";
import { useCampaignsStore } from "@/stores/campaigns-store";

const KEY = ["crm", "campaigns"] as const;

function ref(campaign: Campaign) {
  return { module: "Campanhas" as const, id: campaign.id, label: campaign.name };
}

function invalidate(client: QueryClient) {
  return client.invalidateQueries({ queryKey: KEY });
}

export function useCampaigns() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().campaigns.list() });
}

export function useCreateCampaignFromTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, templateId }: { channel: Channel; templateId: string }) =>
      repositories().campaigns.createFromTemplate(channel, templateId),
    onSuccess: (campaign) => {
      invalidate(client);
      useCampaignsStore.setState({ libraryOpen: false, editorId: campaign.id, editorStep: "conteudo" });
    },
  });
}

export function useSubmitCampaignForReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().campaigns.submitForReview(id),
    onSuccess: (campaign) => {
      invalidate(client);
      recordEvent({
        action: "enviou para revisão a campanha",
        target: ref(campaign),
        changes: [{ field: "Estado", from: "Rascunho", to: campaign.status }],
      });
    },
  });
}

export function useCampaignBackToDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().campaigns.backToDraft(id),
    onSuccess: (campaign) => {
      invalidate(client);
      recordEvent({
        action: "devolveu a rascunho a campanha",
        target: ref(campaign),
        changes: [{ field: "Estado", from: "Em revisão", to: campaign.status }],
      });
    },
  });
}

export function useRecordCampaignTest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().campaigns.recordTest(id),
    onSuccess: (campaign) => {
      invalidate(client);
      recordEvent({
        action: "enviou um teste da campanha",
        target: ref(campaign),
        notify: false,
        sensitive: true,
      });
    },
  });
}

export function useScheduleCampaign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt, recipients, cost }: { id: string; scheduledAt: string; recipients: number; cost?: number }) =>
      repositories().campaigns.schedule(id, scheduledAt, recipients, cost),
    onSuccess: (campaign) => {
      invalidate(client);
      recordEvent({
        action: "agendou a campanha",
        target: ref(campaign),
        sensitive: true,
        changes: [
          { field: "Estado", from: "Em revisão", to: campaign.status },
          { field: "Envio", to: formatDateTime(campaign.scheduledAt ?? "") },
          { field: "Destinatários", to: formatNumber(campaign.recipients) },
        ],
        toast: {
          title: "Campanha agendada",
          description: `${campaign.name} · em modo de teste, nada é enviado a clientes reais.`,
          tone: "success",
        },
      });
    },
  });
}

export function useCancelCampaignSchedule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().campaigns.cancelSchedule(id),
    onSuccess: (campaign) => {
      invalidate(client);
      recordEvent({
        action: "cancelou o agendamento da campanha",
        target: ref(campaign),
        changes: [{ field: "Estado", from: "Agendada", to: campaign.status }],
      });
    },
  });
}

export type { Campaign };
