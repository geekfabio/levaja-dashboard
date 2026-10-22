import { create } from "zustand";
import { CURRENT_USER } from "@/data/companies";
import {
  OPPORTUNITIES,
  type LossReason,
  type Opportunity,
  type OpportunityStage,
} from "@/data/opportunities";
import { DEFAULT_FILTERS } from "@/lib/opportunities";
import { formatDateShort, formatMoney } from "@/lib/format";
import { diffRecord } from "@/lib/audit";
import { recordEvent } from "./audit-store";
import { useAutomationRunsStore } from "./automation-runs-store";

type View = "kanban" | "tabela";

type PendingLossMove = {
  id: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

type OpportunitiesState = {
  opportunities: Opportunity[];
  owner: string;
  stage: string;
  search: string;
  overdue: boolean;
  view: View;
  detailId: string | null;
  detailOpen: boolean;
  newOpportunityOpen: boolean;
  pendingLossMove: PendingLossMove | null;
  setOwner: (owner: string) => void;
  setStage: (stage: string) => void;
  setSearch: (search: string) => void;
  setOverdue: (overdue: boolean) => void;
  resetFilters: () => void;
  setView: (view: View) => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setNewOpportunityOpen: (open: boolean) => void;
  addOpportunity: (opportunity: Opportunity) => void;
  updateOpportunity: (id: string, patch: OpportunityPatch) => void;
  requestStageMove: (id: string, stage: OpportunityStage) => void;
  confirmLossMove: (reason: LossReason) => void;
  cancelLossMove: () => void;
};

export type OpportunityPatch = Partial<
  Pick<Opportunity, "contactName" | "value" | "probability" | "expectedCloseDate" | "owner">
>;

const OPPORTUNITY_LABELS: Partial<Record<keyof Opportunity, string>> = {
  contactName: "Contacto",
  value: "Valor",
  probability: "Probabilidade",
  expectedCloseDate: "Data prevista de fecho",
  owner: "Gestor",
};

const OPPORTUNITY_FORMATTERS = {
  value: (value: number) => formatMoney(value),
  probability: (value: number) => `${value}%`,
  expectedCloseDate: (value: string) => formatDateShort(value),
};

function logStageMove(
  previous: Opportunity,
  stage: OpportunityStage,
  lossReason?: LossReason,
) {
  const target = {
    module: "Oportunidades" as const,
    id: previous.id,
    label: previous.companyName,
  };
  recordEvent({
    action: "moveu a oportunidade",
    target,
    companyId: previous.companyId,
    notify: "stage",
    changes: [
      { field: "Fase", from: previous.stage, to: stage },
      ...(lossReason ? [{ field: "Motivo de perda", to: lossReason }] : []),
    ],
    toast: {
      title: `Movida para ${stage}`,
      description: previous.companyName,
      action: {
        label: "Anular",
        run: () => {
          useOpportunitiesStore.setState((state) => ({
            opportunities: state.opportunities.map((item) =>
              item.id === previous.id ? previous : item,
            ),
          }));
          recordEvent({
            action: "anulou a mudança de fase de",
            target,
            companyId: previous.companyId,
            notify: false,
            changes: [{ field: "Fase", from: stage, to: previous.stage }],
          });
        },
      },
    },
  });
}

export const useOpportunitiesStore = create<OpportunitiesState>((set, get) => ({
  opportunities: OPPORTUNITIES,
  ...DEFAULT_FILTERS,
  view: "kanban",
  detailId: null,
  detailOpen: false,
  newOpportunityOpen: false,
  pendingLossMove: null,

  setOwner: (owner) => set({ owner }),
  setStage: (stage) => set({ stage }),
  setSearch: (search) => set({ search }),
  setOverdue: (overdue) => set({ overdue }),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),
  setView: (view) => set({ view }),

  openDetail: (detailId) => set({ detailId, detailOpen: true }),
  closeDetail: () => set({ detailOpen: false }),
  setNewOpportunityOpen: (newOpportunityOpen) => set({ newOpportunityOpen }),

  addOpportunity: (opportunity) => {
    set((state) => ({
      opportunities: [opportunity, ...state.opportunities],
      newOpportunityOpen: false,
    }));
    recordEvent({
      action: "criou a oportunidade",
      target: { module: "Oportunidades", id: opportunity.id, label: opportunity.companyName },
      companyId: opportunity.companyId,
      changes: [
        { field: "Valor", to: formatMoney(opportunity.value) },
        { field: "Fase", to: opportunity.stage },
      ],
      toast: {
        title: "Oportunidade criada",
        description: `${opportunity.companyName} · ${formatMoney(opportunity.value)}`,
        tone: "success",
        action: { label: "Abrir", run: () => get().openDetail(opportunity.id) },
      },
    });
  },

  updateOpportunity: (id, patch) => {
    const previous = get().opportunities.find((item) => item.id === id);
    if (!previous) return;
    const next = { ...previous, ...patch };
    const changes = diffRecord(previous, next, OPPORTUNITY_LABELS, OPPORTUNITY_FORMATTERS);
    if (changes.length === 0) return;
    set((state) => ({
      opportunities: state.opportunities.map((item) => (item.id === id ? next : item)),
    }));
    recordEvent({
      action: "atualizou a oportunidade",
      target: { module: "Oportunidades", id, label: next.companyName },
      companyId: next.companyId,
      notify: false,
      changes,
      toast: {
        title: "Oportunidade atualizada",
        description: changes.map((change) => change.field).join(", "),
        tone: "success",
        action: {
          label: "Anular",
          run: () =>
            set((state) => ({
              opportunities: state.opportunities.map((item) => (item.id === id ? previous : item)),
            })),
        },
      },
    });
  },

  requestStageMove: (id, stage) => {
    const opportunity = get().opportunities.find((item) => item.id === id);
    if (!opportunity || opportunity.stage === stage) return;

    if (stage === "Fechada - Perdida") {
      set({ pendingLossMove: { id } });
      return;
    }

    set((state) => ({
      opportunities: state.opportunities.map((item) =>
        item.id === id
          ? {
              ...item,
              stage,
              probability: stage === "Fechada - Ganha" ? 100 : item.probability,
              lossReason: undefined,
              stageHistory: [
                ...item.stageHistory,
                { stage, date: today(), author: CURRENT_USER.name },
              ],
            }
          : item,
      ),
    }));
    logStageMove(opportunity, stage);
    const automationEvents = useAutomationRunsStore.getState();
    automationEvents.emit("fase-alterada", opportunity.companyId, { stage });
    if (stage === "Fechada - Ganha") automationEvents.emit("oportunidade-ganha", opportunity.companyId);
  },

  confirmLossMove: (reason) => {
    const pending = get().pendingLossMove;
    if (!pending) return;
    const opportunity = get().opportunities.find((item) => item.id === pending.id);
    if (!opportunity) return;

    set((state) => ({
      opportunities: state.opportunities.map((item) =>
        item.id === pending.id
          ? {
              ...item,
              stage: "Fechada - Perdida",
              probability: 0,
              lossReason: reason,
              stageHistory: [
                ...item.stageHistory,
                {
                  stage: "Fechada - Perdida",
                  date: today(),
                  author: CURRENT_USER.name,
                },
              ],
            }
          : item,
      ),
      pendingLossMove: null,
    }));
    logStageMove(opportunity, "Fechada - Perdida", reason);
    const automationEvents = useAutomationRunsStore.getState();
    automationEvents.emit("fase-alterada", opportunity.companyId, { stage: "Fechada - Perdida" });
    automationEvents.emit("oportunidade-perdida", opportunity.companyId);
  },

  cancelLossMove: () => set({ pendingLossMove: null }),
}));
