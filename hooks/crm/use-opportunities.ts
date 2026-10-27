"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { OpportunityDraft, OpportunityPatch } from "@/data/crm";
import { type LossReason, type Opportunity, type OpportunityStage } from "@/data/opportunities";
import { diffRecord } from "@/lib/audit";
import { formatDateShort, formatMoney } from "@/lib/format";
import { recordEvent } from "@/stores/audit-store";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

const KEY = ["crm", "opportunities"] as const;

const LABELS: Partial<Record<keyof Opportunity, string>> = {
  contactName: "Contacto",
  value: "Valor",
  probability: "Probabilidade",
  expectedCloseDate: "Data prevista de fecho",
  owner: "Gestor",
};

const FORMATTERS = {
  value: (value: number) => formatMoney(value),
  probability: (value: number) => `${value}%`,
  expectedCloseDate: (value: string) => formatDateShort(value),
};

function ref(opportunity: Opportunity) {
  return { module: "Oportunidades" as const, id: opportunity.id, label: opportunity.companyName };
}

function invalidate(client: QueryClient) {
  return client.invalidateQueries({ queryKey: KEY });
}

export function useOpportunities() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().opportunities.list(), placeholderData: keepPreviousData });
}

export function useOpportunity(id: string | null) {
  const query = useOpportunities();
  return { ...query, data: id ? query.data?.find((item) => item.id === id) : undefined };
}

export function useCreateOpportunity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: OpportunityDraft) => repositories().opportunities.create(draft),
    onSuccess: (opportunity) => {
      invalidate(client);
      recordEvent({
        action: "criou a oportunidade",
        target: ref(opportunity),
        companyId: opportunity.companyId,
        changes: [
          { field: "Valor", to: formatMoney(opportunity.value) },
          { field: "Fase", to: opportunity.stage },
        ],
        toast: {
          title: "Oportunidade criada",
          description: `${opportunity.companyName} · ${formatMoney(opportunity.value)}`,
          tone: "success",
          action: { label: "Abrir", run: () => useOpportunitiesStore.getState().openDetail(opportunity.id) },
        },
      });
    },
  });
}

export function useUpdateOpportunity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OpportunityPatch; previous: Opportunity }) => repositories().opportunities.update(id, patch),
    onSuccess: (opportunity, { previous }) => {
      invalidate(client);
      const changes = diffRecord(previous, opportunity, LABELS, FORMATTERS);
      if (changes.length === 0) return;
      const undo: OpportunityPatch = {
        contactName: previous.contactName,
        value: previous.value,
        probability: previous.probability,
        expectedCloseDate: previous.expectedCloseDate,
        owner: previous.owner,
      };
      recordEvent({
        action: "atualizou a oportunidade",
        target: ref(opportunity),
        companyId: opportunity.companyId,
        notify: false,
        changes,
        toast: {
          title: "Oportunidade atualizada",
          description: changes.map((change) => change.field).join(", "),
          tone: "success",
          action: { label: "Anular", run: () => repositories().opportunities.update(opportunity.id, undo).then(() => invalidate(client)) },
        },
      });
    },
  });
}

export function useMoveStage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, lossReason }: { id: string; stage: OpportunityStage; previous: Opportunity; lossReason?: LossReason }) =>
      repositories().opportunities.moveStage(id, stage, lossReason),
    onMutate: async ({ id, stage }) => {
      await client.cancelQueries({ queryKey: KEY });
      const snapshot = client.getQueryData<Opportunity[]>(KEY);
      client.setQueryData<Opportunity[]>(KEY, (current) => current?.map((item) => (item.id === id ? { ...item, stage } : item)));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) client.setQueryData(KEY, context.snapshot);
    },
    onSuccess: (opportunity, { previous }) => {
      const stage = opportunity.stage;
      recordEvent({
        action: "moveu a oportunidade",
        target: ref(opportunity),
        companyId: opportunity.companyId,
        notify: "stage",
        changes: [
          { field: "Fase", from: previous.stage, to: stage },
          ...(opportunity.lossReason ? [{ field: "Motivo de perda", to: opportunity.lossReason }] : []),
        ],
        toast: {
          title: `Movida para ${stage}`,
          description: opportunity.companyName,
          action: {
            label: "Anular",
            run: () =>
              repositories()
                .opportunities.moveStage(opportunity.id, previous.stage, previous.lossReason)
                .then(() => {
                  invalidate(client);
                  recordEvent({
                    action: "anulou a mudança de fase de",
                    target: ref(opportunity),
                    companyId: opportunity.companyId,
                    notify: false,
                    changes: [{ field: "Fase", from: stage, to: previous.stage }],
                  });
                }),
          },
        },
      });
      const automationEvents = useAutomationRunsStore.getState();
      automationEvents.emit("fase-alterada", opportunity.companyId, { stage });
      if (stage === "Fechada - Ganha") automationEvents.emit("oportunidade-ganha", opportunity.companyId);
      if (stage === "Fechada - Perdida") automationEvents.emit("oportunidade-perdida", opportunity.companyId);
    },
    onSettled: () => invalidate(client),
  });
}
