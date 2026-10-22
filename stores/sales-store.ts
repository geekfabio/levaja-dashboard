import { create } from "zustand";
import {
  CUSTOMER_IDENTIFIERS,
  IDENTIFIER_TYPES,
  SALES,
  type CustomerIdentifiers,
  type IdentifierType,
  type Sale,
} from "@/data/sales";
import { formatMoney, formatPercent } from "@/lib/format";
import { mockSalesSource } from "@/lib/integrations/sales/mock-source";
import type { IncomingSale } from "@/lib/integrations/sales/types";
import { matchCustomer } from "@/lib/sales";
import { recordEvent } from "./audit-store";
import { useAutomationRunsStore } from "./automation-runs-store";
import { useCompaniesStore } from "./companies-store";
import { useOpportunitiesStore } from "./opportunities-store";

export type IntegrationEvent = {
  id: string;
  at: string;
  document: string;
  total: number;
  result: "Associada" | "Por associar";
  companyId?: string;
};

export const SIMULATION_INTERVALS = [15, 30, 60] as const;

type SalesState = {
  sales: Sale[];
  identifiers: Record<string, CustomerIdentifiers>;
  identificationOrder: IdentifierType[];
  autoSimulate: boolean;
  intervalSeconds: number;
  lastSyncAt: string | null;
  events: IntegrationEvent[];
  associateId: string | null;
  search: string;
  setSearch: (search: string) => void;
  ingest: (incoming: IncomingSale, options?: { announce?: boolean; companyId?: string }) => Sale;
  simulate: (announce?: boolean) => Sale;
  associate: (saleId: string, companyId: string, saveIdentifier: boolean) => void;
  markPaid: (saleId: string) => void;
  setAutoSimulate: (enabled: boolean) => void;
  setIntervalSeconds: (seconds: number) => void;
  toggleIdentifier: (type: IdentifierType) => void;
  setAssociateId: (id: string | null) => void;
};

function companyName(id: string) {
  return useCompaniesStore.getState().companies.find((company) => company.id === id)?.name ?? id;
}

function touchCompany(companyId: string, sale: Sale) {
  useCompaniesStore.setState((state) => ({
    companies: state.companies.map((company) =>
      company.id === companyId
        ? {
            ...company,
            activityDays: 0,
            lastInteraction: { date: sale.at.slice(0, 10), label: "Compra" },
          }
        : company,
    ),
  }));
}

function openOpportunityFor(companyId: string) {
  return useOpportunitiesStore
    .getState()
    .opportunities.find(
      (item) => item.companyId === companyId && (item.stage === "Proposta" || item.stage === "Negociação"),
    );
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: SALES,
  identifiers: CUSTOMER_IDENTIFIERS,
  identificationOrder: [...IDENTIFIER_TYPES],
  autoSimulate: false,
  intervalSeconds: 30,
  lastSyncAt: null,
  events: [],
  associateId: null,
  search: "",
  setSearch: (search) => set({ search }),

  ingest: (incoming, options = {}) => {
    const { identifiers, identificationOrder } = get();
    const companyId = options.companyId ?? matchCustomer(incoming.identifier, identifiers, identificationOrder);
    const sale: Sale = {
      ...incoming,
      id: `vd-${crypto.randomUUID().slice(0, 8)}`,
      companyId,
    };
    set((state) => ({
      sales: [sale, ...state.sales],
      lastSyncAt: sale.at,
      events: [
        {
          id: sale.id,
          at: sale.at,
          document: sale.document,
          total: sale.total,
          result: companyId ? ("Associada" as const) : ("Por associar" as const),
          companyId,
        },
        ...state.events,
      ].slice(0, 30),
    }));

    if (companyId) {
      touchCompany(companyId, sale);
      const offer = useAutomationRunsStore.getState().registerPurchase(sale);
      const opportunity = openOpportunityFor(companyId);
      recordEvent({
        action: "registou uma compra de",
        target: { module: "Clientes", id: companyId, label: companyName(companyId) },
        companyId,
        notify: false,
        changes: [
          { field: "Documento", to: sale.document },
          { field: "Total", to: formatMoney(sale.total) },
          { field: "Pagamento", to: sale.payment },
        ],
        toast: options.announce
          ? {
              title: `Compra de ${companyName(companyId)}`,
              description: offer
                ? `${sale.document} · ${formatMoney(sale.total)} — aproveitou o desconto de ${formatPercent(offer.percent)} (${formatMoney(offer.discountValue ?? 0)}).`
                : `${sale.document} · ${formatMoney(sale.total)} · ${sale.payment}`,
              tone: "success",
              action: opportunity
                ? {
                    label: "Marcar oportunidade como ganha",
                    run: () => useOpportunitiesStore.getState().requestStageMove(opportunity.id, "Fechada - Ganha"),
                  }
                : {
                    label: "Abrir cliente",
                    run: () => useCompaniesStore.getState().openDetail(companyId),
                  },
            }
          : undefined,
      });
    } else {
      recordEvent({
        action: "recebeu uma compra sem cliente identificado:",
        target: { module: "Vendas", id: sale.id, label: sale.document },
        notify: "alert",
        toast: options.announce ? {
          title: "Compra por associar",
          description: `${sale.document} · ${formatMoney(sale.total)} — cliente não identificado.`,
          action: { label: "Associar", run: () => get().setAssociateId(sale.id) },
        } : undefined,
      });
    }
    return sale;
  },

  simulate: (announce = true) => get().ingest(mockSalesSource.nextSale(), { announce }),

  associate: (saleId, companyId, saveIdentifier) => {
    const sale = get().sales.find((item) => item.id === saleId);
    if (!sale) return;
    set((state) => ({
      sales: state.sales.map((item) => (item.id === saleId ? { ...item, companyId } : item)),
      associateId: null,
      identifiers:
        saveIdentifier && sale.identifier
          ? {
              ...state.identifiers,
              [companyId]: {
                ...(state.identifiers[companyId] ?? { card: "", nif: "", phone: "" }),
                ...(sale.identifier.type === "Cartão de cliente"
                  ? { card: sale.identifier.value }
                  : sale.identifier.type === "NIF"
                    ? { nif: sale.identifier.value }
                    : { phone: sale.identifier.value }),
              },
            }
          : state.identifiers,
    }));
    touchCompany(companyId, sale);
    useAutomationRunsStore.getState().registerPurchase({ ...sale, companyId });
    recordEvent({
      action: `associou a compra ${sale.document} a`,
      target: { module: "Clientes", id: companyId, label: companyName(companyId) },
      companyId,
      sensitive: saveIdentifier,
      notify: false,
      changes: saveIdentifier && sale.identifier ? [{ field: sale.identifier.type, to: sale.identifier.value }] : [],
      toast: { title: "Compra associada", description: `${sale.document} → ${companyName(companyId)}`, tone: "success" },
    });
  },

  markPaid: (saleId) => {
    const sale = get().sales.find((item) => item.id === saleId);
    if (!sale || sale.paid) return;
    set((state) => ({
      sales: state.sales.map((item) => (item.id === saleId ? { ...item, paid: true } : item)),
    }));
    if (sale.companyId) {
      recordEvent({
        action: `registou o pagamento de ${sale.document} de`,
        target: { module: "Clientes", id: sale.companyId, label: companyName(sale.companyId) },
        companyId: sale.companyId,
        sensitive: true,
        notify: false,
        changes: [{ field: "Estado", from: "Em dívida", to: "Pago" }],
        toast: { title: "Pagamento registado", description: `${sale.document} · ${formatMoney(sale.total)}`, tone: "success" },
      });
    }
  },

  setAutoSimulate: (autoSimulate) => set({ autoSimulate }),
  setIntervalSeconds: (intervalSeconds) => set({ intervalSeconds }),
  toggleIdentifier: (type) =>
    set((state) => ({
      identificationOrder: state.identificationOrder.includes(type)
        ? state.identificationOrder.filter((item) => item !== type)
        : IDENTIFIER_TYPES.filter((item) => item === type || state.identificationOrder.includes(item)),
    })),
  setAssociateId: (associateId) => set({ associateId }),
}));
