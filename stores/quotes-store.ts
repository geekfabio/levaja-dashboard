import { create } from "zustand";
import { CATALOG, PRICE_LIST_DISCOUNTS, type Product } from "@/data/catalog";
import type { Segment } from "@/data/companies";
import {
  ORDERS,
  QUOTES,
  type DocumentLine,
  type FulfilmentType,
  type Order,
  type OrderStatus,
  type Quote,
} from "@/data/quotes";
import { addDays } from "@/lib/follow-up";
import { formatMoney, nowLuandaLocal } from "@/lib/format";
import { documentTotals, nextNumber, priceListDiscount, productLine } from "@/lib/quotes";
import { recordEvent } from "./audit-store";
import { companyProfile, useCompaniesStore } from "./companies-store";
import { useOpportunitiesStore } from "./opportunities-store";
import { useSalesStore } from "./sales-store";

export type QuotesView = "cotacoes" | "encomendas";

type QuotesState = {
  quotes: Quote[];
  orders: Order[];
  catalog: Product[];
  discounts: Record<Segment, number>;
  view: QuotesView;
  search: string;
  status: string;
  quoteId: string | null;
  orderId: string | null;
  newQuoteOpen: boolean;
  printId: string | null;
  setView: (view: QuotesView) => void;
  setSearch: (search: string) => void;
  setStatus: (status: string) => void;
  openQuote: (id: string | null) => void;
  openOrder: (id: string | null) => void;
  setNewQuoteOpen: (open: boolean) => void;
  setPrintId: (id: string | null) => void;
  createQuote: (companyId: string, opportunityId?: string) => string;
  updateQuote: (id: string, patch: Partial<Pick<Quote, "validUntil" | "notes" | "priceListDiscount">>) => void;
  addLine: (id: string, productId: string) => void;
  updateLine: (id: string, lineId: string, patch: Partial<Pick<DocumentLine, "quantity" | "discount">>) => void;
  removeLine: (id: string, lineId: string) => void;
  setQuoteStatus: (id: string, status: "Rascunho" | "Enviada" | "Aceite" | "Recusada") => void;
  duplicateQuote: (id: string) => void;
  convertToOrder: (id: string, deliveryDate: string, fulfilment: FulfilmentType) => void;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  saveProduct: (product: Product) => void;
  setDiscount: (segment: Segment, value: number) => void;
};

function today() {
  return nowLuandaLocal().slice(0, 10);
}

function companyName(id: string) {
  return useCompaniesStore.getState().companies.find((company) => company.id === id)?.name ?? id;
}

export const useQuotesStore = create<QuotesState>((set, get) => {
  function editQuote(id: string, fn: (quote: Quote) => Partial<Quote>) {
    set((state) => ({
      quotes: state.quotes.map((quote) => (quote.id === id && quote.status === "Rascunho" ? { ...quote, ...fn(quote) } : quote)),
    }));
  }

  return {
    quotes: QUOTES,
    orders: ORDERS,
    catalog: CATALOG,
    discounts: PRICE_LIST_DISCOUNTS,
    view: "cotacoes",
    search: "",
    status: "all",
    quoteId: null,
    orderId: null,
    newQuoteOpen: false,
    printId: null,
    setView: (view) => set({ view, status: "all" }),
    setSearch: (search) => set({ search }),
    setStatus: (status) => set({ status }),
    openQuote: (quoteId) => set({ quoteId }),
    openOrder: (orderId) => set({ orderId }),
    setNewQuoteOpen: (newQuoteOpen) => set({ newQuoteOpen }),
    setPrintId: (printId) => set({ printId }),

    createQuote: (companyId, opportunityId) => {
      const company = useCompaniesStore.getState().companies.find((item) => item.id === companyId);
      const id = `cot-${crypto.randomUUID().slice(0, 8)}`;
      const date = today();
      const quote: Quote = {
        id,
        number: nextNumber("COT", get().quotes.map((item) => item.number), date.slice(0, 4)),
        companyId,
        opportunityId,
        owner: company?.owner ?? "",
        createdAt: date,
        validUntil: addDays(date, 15),
        status: "Rascunho",
        priceListDiscount: priceListDiscount(company, get().discounts),
        lines: [],
        notes: "",
      };
      set((state) => ({ quotes: [quote, ...state.quotes], quoteId: id, newQuoteOpen: false, view: "cotacoes" }));
      recordEvent({
        action: "criou a cotação",
        target: { module: "Cotações", id, label: `${quote.number} · ${companyName(companyId)}` },
        companyId,
        notify: false,
      });
      return id;
    },

    updateQuote: (id, patch) => editQuote(id, () => patch),
    addLine: (id, productId) => {
      const product = get().catalog.find((item) => item.id === productId);
      if (!product) return;
      editQuote(id, (quote) => {
        const existing = quote.lines.find((item) => item.productId === productId);
        return {
          lines: existing
            ? quote.lines.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item))
            : [...quote.lines, productLine(product)],
        };
      });
    },
    updateLine: (id, lineId, patch) =>
      editQuote(id, (quote) => ({
        lines: quote.lines.map((item) =>
          item.id === lineId
            ? {
                ...item,
                quantity: patch.quantity !== undefined ? Math.max(1, Math.round(patch.quantity)) : item.quantity,
                discount: patch.discount !== undefined ? Math.min(30, Math.max(0, patch.discount)) : item.discount,
              }
            : item,
        ),
      })),
    removeLine: (id, lineId) => editQuote(id, (quote) => ({ lines: quote.lines.filter((item) => item.id !== lineId) })),

    setQuoteStatus: (id, status) => {
      const quote = get().quotes.find((item) => item.id === id);
      if (!quote || quote.status === status) return;
      set((state) => ({ quotes: state.quotes.map((item) => (item.id === id ? { ...item, status } : item)) }));
      const totals = documentTotals(quote.lines, quote.priceListDiscount);
      const opportunity = quote.opportunityId
        ? useOpportunitiesStore.getState().opportunities.find((item) => item.id === quote.opportunityId)
        : undefined;
      recordEvent({
        action:
          status === "Enviada"
            ? "marcou como enviada a cotação"
            : status === "Aceite"
              ? "registou a aceitação da cotação"
              : status === "Recusada"
                ? "registou a recusa da cotação"
                : "reabriu a cotação",
        target: { module: "Cotações", id, label: `${quote.number} · ${companyName(quote.companyId)}` },
        companyId: quote.companyId,
        notify: false,
        changes: [
          { field: "Estado", from: quote.status, to: status },
          { field: "Total", to: formatMoney(totals.total) },
        ],
        toast: {
          title: `Cotação ${status === "Rascunho" ? "reaberta" : status.toLowerCase()}`,
          description: `${quote.number} · ${formatMoney(totals.total)}`,
          tone: "success",
          action:
            status === "Aceite" && opportunity && !opportunity.stage.startsWith("Fechada")
              ? {
                  label: "Marcar oportunidade como ganha",
                  run: () => useOpportunitiesStore.getState().requestStageMove(opportunity.id, "Fechada - Ganha"),
                }
              : {
                  label: "Anular",
                  run: () =>
                    set((state) => ({
                      quotes: state.quotes.map((item) => (item.id === id ? { ...item, status: quote.status } : item)),
                    })),
                },
        },
      });
    },

    duplicateQuote: (id) => {
      const quote = get().quotes.find((item) => item.id === id);
      if (!quote) return;
      const copyId = `cot-${crypto.randomUUID().slice(0, 8)}`;
      const date = today();
      const copy: Quote = {
        ...quote,
        id: copyId,
        number: nextNumber("COT", get().quotes.map((item) => item.number), date.slice(0, 4)),
        createdAt: date,
        validUntil: addDays(date, 15),
        status: "Rascunho",
        orderId: undefined,
        lines: quote.lines.map((item) => ({ ...item, id: `l-${crypto.randomUUID().slice(0, 8)}` })),
      };
      set((state) => ({ quotes: [copy, ...state.quotes], quoteId: copyId }));
      recordEvent({
        action: `duplicou ${quote.number} em`,
        target: { module: "Cotações", id: copyId, label: copy.number },
        companyId: quote.companyId,
        notify: false,
        toast: { title: "Cotação duplicada", description: `${copy.number} em rascunho`, tone: "success" },
      });
    },

    convertToOrder: (id, deliveryDate, fulfilment) => {
      const quote = get().quotes.find((item) => item.id === id);
      if (!quote || quote.status !== "Aceite") return;
      const orderId = `enc-${crypto.randomUUID().slice(0, 8)}`;
      const date = today();
      const order: Order = {
        id: orderId,
        number: nextNumber("ENC", get().orders.map((item) => item.number), date.slice(0, 4)),
        companyId: quote.companyId,
        quoteId: id,
        owner: quote.owner,
        createdAt: date,
        deliveryDate,
        fulfilment,
        status: "Pendente",
        lines: quote.lines,
        priceListDiscount: quote.priceListDiscount,
        notes: quote.notes,
      };
      set((state) => ({
        orders: [order, ...state.orders],
        quotes: state.quotes.map((item) => (item.id === id ? { ...item, status: "Convertida", orderId } : item)),
        quoteId: null,
        orderId,
        view: "encomendas",
      }));
      recordEvent({
        action: `converteu ${quote.number} na encomenda`,
        target: { module: "Cotações", id: orderId, label: `${order.number} · ${companyName(order.companyId)}` },
        companyId: order.companyId,
        notify: false,
        changes: [
          { field: "Entrega", to: `${fulfilment} · ${deliveryDate.split("-").reverse().join("/")}` },
          { field: "Total", to: formatMoney(documentTotals(order.lines, order.priceListDiscount).total) },
        ],
        toast: { title: "Encomenda criada", description: `${order.number} · ${companyName(order.companyId)}`, tone: "success" },
      });
    },

    setOrderStatus: (id, status) => {
      const order = get().orders.find((item) => item.id === id);
      if (!order || order.status === status || order.status === "Entregue" || order.status === "Cancelada") return;
      let saleDocument: string | undefined;
      if (status === "Entregue") {
        const company = useCompaniesStore.getState().companies.find((item) => item.id === order.companyId);
        const profile = company ? companyProfile(company) : undefined;
        const totals = documentTotals(order.lines, order.priceListDiscount);
        const sales = useSalesStore.getState();
        const lastNumber = Math.max(0, ...sales.sales.map((sale) => Number(sale.document.split("/")[1]) || 0));
        saleDocument = `FR 2026/${lastNumber + 1}`;
        sales.ingest(
          {
            document: saleDocument,
            at: nowLuandaLocal(),
            channel: order.fulfilment === "Entrega" ? "Entrega" : "Loja Viana",
            payment: profile && profile.paymentTerms !== "Pronto pagamento" ? "Crédito" : "Transferência",
            identifier: profile?.nif ? { type: "NIF", value: profile.nif } : undefined,
            lines: order.lines.map((item) => ({
              category: item.category,
              description: item.name,
              quantity: item.quantity,
              unitPrice: Math.round(item.unitPrice * (1 - order.priceListDiscount / 100) * (1 - item.discount / 100)),
            })),
            total: totals.total,
            paid: !profile || profile.paymentTerms === "Pronto pagamento",
            source: "Simulação",
          },
          { announce: false, companyId: order.companyId },
        );
      }
      set((state) => ({
        orders: state.orders.map((item) => (item.id === id ? { ...item, status, saleDocument: saleDocument ?? item.saleDocument } : item)),
      }));
      recordEvent({
        action: status === "Cancelada" ? "cancelou a encomenda" : `marcou como «${status}» a encomenda`,
        target: { module: "Cotações", id, label: `${order.number} · ${companyName(order.companyId)}` },
        companyId: order.companyId,
        notify: false,
        changes: [{ field: "Estado", from: order.status, to: status }, ...(saleDocument ? [{ field: "Fatura", to: saleDocument }] : [])],
        toast: {
          title: status === "Entregue" ? "Encomenda entregue" : `Encomenda ${status.toLowerCase()}`,
          description: saleDocument ? `${order.number} faturada como ${saleDocument} (simulação do sistema de vendas).` : order.number,
          tone: "success",
        },
      });
    },

    saveProduct: (product) => {
      const exists = get().catalog.some((item) => item.id === product.id);
      set((state) => ({
        catalog: exists ? state.catalog.map((item) => (item.id === product.id ? product : item)) : [...state.catalog, product],
      }));
      recordEvent({
        action: exists ? "atualizou o produto" : "adicionou ao catálogo",
        target: { module: "Definições", label: `${product.id} · ${product.name}` },
        notify: false,
        changes: [{ field: "Preço", to: formatMoney(product.price) }, { field: "Ativo", to: product.active ? "Sim" : "Não" }],
        toast: { title: exists ? "Produto atualizado" : "Produto adicionado", description: product.name, tone: "success" },
      });
    },

    setDiscount: (segment, value) =>
      set((state) => ({ discounts: { ...state.discounts, [segment]: Math.min(30, Math.max(0, Math.round(value))) } })),
  };
});
