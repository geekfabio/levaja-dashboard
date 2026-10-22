"use client";

import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import Tag from "@/components/_ui/tag";
import DetailSection from "@/components/_common/detail-section";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import { ORDER_STATUSES, ORDER_STATUS_TONES, type OrderStatus } from "@/data/quotes";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { companyProfile, useCompaniesStore } from "@/stores/companies-store";
import { useQuotesStore } from "@/stores/quotes-store";
import DocumentLines from "./document-lines";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

const FLOW: OrderStatus[] = ORDER_STATUSES.filter((status) => status !== "Cancelada");

export default function OrderDetail() {
  const orderId = useQuotesStore((state) => state.orderId);
  const order = useQuotesStore((state) => state.orders.find((item) => item.id === orderId));
  const quote = useQuotesStore((state) => state.quotes.find((item) => item.id === order?.quoteId));
  const openOrder = useQuotesStore((state) => state.openOrder);
  const openQuote = useQuotesStore((state) => state.openQuote);
  const setOrderStatus = useQuotesStore((state) => state.setOrderStatus);
  const setPrintId = useQuotesStore((state) => state.setPrintId);
  const company = useCompaniesStore((state) => state.companies.find((item) => item.id === order?.companyId));
  const openTarget = useOpenTarget();
  const closed = order?.status === "Entregue" || order?.status === "Cancelada";
  const step = order ? FLOW.indexOf(order.status) : -1;

  return (
    <Sheet open={Boolean(order)} onOpenChange={(open) => !open && openOrder(null)}>
      <SheetContent side="right" className="sm:w-[640px] sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{order?.number ?? "Encomenda"}</SheetTitle>
          <SheetDescription className="sr-only">Estado, entrega e linhas da encomenda</SheetDescription>
          <Button variant="ghost" size="icon-sm" className="-mr-1" aria-label="Fechar encomenda" onClick={() => openOrder(null)}>
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetHeader>

        {order && (
          <ScrollArea className="min-h-0 flex-1">
            <DetailSection title="Estado">
              {order.status === "Cancelada" ? (
                <Tag tone={ORDER_STATUS_TONES.Cancelada}>Cancelada</Tag>
              ) : (
                <ol className="grid grid-cols-3 gap-2" aria-label="Progresso da encomenda">
                  {FLOW.map((status, index) => (
                    <li key={status} className="flex flex-col gap-1.5" aria-current={index === step ? "step" : undefined}>
                      <span className={cn("h-1.5 rounded-full", index <= step ? "bg-primary" : "bg-white/8")} />
                      <span className={cn("caption-style", index <= step ? "text-foreground" : "text-subtle")}>{status}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <span className="caption-style text-subtle">Cliente</span>
                  <Button
                    variant="link"
                    size="none"
                    className="justify-start font-medium no-underline"
                    onClick={() => company && openTarget({ module: "Clientes", id: company.id, label: company.name })}
                  >
                    {company?.name ?? order.companyId}
                  </Button>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="caption-style text-subtle">{order.fulfilment}</span>
                  <span className="lead-style">{formatDateLong(order.deliveryDate)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="caption-style text-subtle">Pagamento</span>
                  <span className="lead-style">{company ? companyProfile(company).paymentTerms : "—"}</span>
                </div>
              </div>
              {order.fulfilment === "Entrega" && company && companyProfile(company).address && (
                <span className="caption-style text-soft">
                  Morada de entrega: {companyProfile(company).address}, {companyProfile(company).municipality}
                </span>
              )}
              {order.saleDocument && (
                <span className="caption-style text-soft">Faturada no sistema de vendas como {order.saleDocument}.</span>
              )}
              {quote && (
                <Button
                  variant="link"
                  size="none"
                  className="caption-style self-start"
                  onClick={() => {
                    openOrder(null);
                    openQuote(quote.id);
                  }}
                >
                  Da cotação {quote.number}
                </Button>
              )}
            </DetailSection>

            <DetailSection title={`Produtos · ${order.lines.length}`}>
              <DocumentLines lines={order.lines} listDiscount={order.priceListDiscount} />
            </DetailSection>
          </ScrollArea>
        )}

        {order && (
          <SheetFooter className="flex-wrap justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPrintId(order.id)}>
              Imprimir guia
            </Button>
            {!closed && (
              <div className="flex flex-wrap gap-2">
                <Button variant="subtle" size="sm" onClick={() => setOrderStatus(order.id, "Cancelada")}>
                  Cancelar encomenda
                </Button>
                {order.status === "Pendente" && (
                  <Button variant="secondary" size="sm" onClick={() => setOrderStatus(order.id, "Em preparação")}>
                    Em preparação
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => setOrderStatus(order.id, "Entregue")}>
                  Marcar como entregue
                </Button>
              </div>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
