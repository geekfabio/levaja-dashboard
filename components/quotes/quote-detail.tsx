"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
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
import { FULFILMENT_TYPES, QUOTE_STATUS_TONES, type FulfilmentType } from "@/data/quotes";
import { useToday } from "@/hooks/use-today";
import { addDays } from "@/lib/follow-up";
import { formatDateLong, formatDateShort, formatPercent } from "@/lib/format";
import { quoteStatus } from "@/lib/quotes";
import { useCompaniesStore } from "@/stores/companies-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useQuotesStore } from "@/stores/quotes-store";
import DocumentLines from "./document-lines";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export default function QuoteDetail() {
  const quoteId = useQuotesStore((state) => state.quoteId);
  const quote = useQuotesStore((state) => state.quotes.find((item) => item.id === quoteId));
  const openQuote = useQuotesStore((state) => state.openQuote);
  const openOrder = useQuotesStore((state) => state.openOrder);
  const updateQuote = useQuotesStore((state) => state.updateQuote);
  const addLine = useQuotesStore((state) => state.addLine);
  const updateLine = useQuotesStore((state) => state.updateLine);
  const removeLine = useQuotesStore((state) => state.removeLine);
  const setQuoteStatus = useQuotesStore((state) => state.setQuoteStatus);
  const duplicateQuote = useQuotesStore((state) => state.duplicateQuote);
  const convertToOrder = useQuotesStore((state) => state.convertToOrder);
  const setPrintId = useQuotesStore((state) => state.setPrintId);
  const company = useCompaniesStore((state) => state.companies.find((item) => item.id === quote?.companyId));
  const opportunity = useOpportunitiesStore((state) =>
    state.opportunities.find((item) => item.id === quote?.opportunityId),
  );
  const openTarget = useOpenTarget();
  const today = useToday();
  const [converting, setConverting] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [fulfilment, setFulfilment] = useState<FulfilmentType>("Entrega");

  const status = quote ? quoteStatus(quote, today) : "Rascunho";
  const editable = quote?.status === "Rascunho";

  function close() {
    setConverting(false);
    openQuote(null);
  }

  return (
    <Sheet open={Boolean(quote)} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="sm:w-[640px] sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{quote?.number ?? "Cotação"}</SheetTitle>
          <SheetDescription className="sr-only">Linhas, totais e estado da cotação</SheetDescription>
          <Button variant="ghost" size="icon-sm" className="-mr-1" aria-label="Fechar cotação" onClick={close}>
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetHeader>

        {quote && (
          <ScrollArea className="min-h-0 flex-1">
            <DetailSection title="Cliente">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={QUOTE_STATUS_TONES[status]}>{status}</Tag>
                <Button
                  variant="link"
                  size="none"
                  className="font-medium no-underline"
                  onClick={() => company && openTarget({ module: "Clientes", id: company.id, label: company.name })}
                >
                  {company?.name ?? quote.companyId}
                </Button>
                {opportunity && (
                  <Button
                    variant="link"
                    size="none"
                    className="caption-style text-soft"
                    onClick={() => openTarget({ module: "Oportunidades", id: opportunity.id, label: opportunity.companyName })}
                  >
                    Oportunidade · {opportunity.stage}
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <span className="caption-style text-subtle">Criada</span>
                  <span className="lead-style tabular-nums">{formatDateShort(quote.createdAt)}</span>
                </div>
                {editable ? (
                  <Field label="Válida até" htmlFor="quote-valid">
                    <Input
                      id="quote-valid"
                      type="date"
                      min={today}
                      value={quote.validUntil}
                      onChange={(event) => updateQuote(quote.id, { validUntil: event.target.value })}
                      className="tabular-nums"
                    />
                  </Field>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="caption-style text-subtle">Válida até</span>
                    <span className="lead-style tabular-nums">{formatDateLong(quote.validUntil)}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="caption-style text-subtle">Tabela de preços</span>
                  <span className="lead-style">−{formatPercent(quote.priceListDiscount)} sobre o preço base</span>
                </div>
              </div>
            </DetailSection>

            <DetailSection title={`Produtos · ${quote.lines.length}`}>
              <DocumentLines
                lines={quote.lines}
                listDiscount={quote.priceListDiscount}
                editable={editable}
                onAdd={(productId) => addLine(quote.id, productId)}
                onChange={(lineId, patch) => updateLine(quote.id, lineId, patch)}
                onRemove={(lineId) => removeLine(quote.id, lineId)}
              />
            </DetailSection>

            <DetailSection title="Observações">
              {editable ? (
                <Input
                  aria-label="Observações da cotação"
                  value={quote.notes}
                  placeholder="Ex.: entrega semanal, condições especiais…"
                  onChange={(event) => updateQuote(quote.id, { notes: event.target.value })}
                />
              ) : (
                <p className="lead-style text-soft">{quote.notes || "Sem observações."}</p>
              )}
            </DetailSection>

            {converting && (
              <DetailSection title="Converter em encomenda">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Data de entrega" htmlFor="order-date" required>
                    <Input
                      id="order-date"
                      type="date"
                      min={today}
                      value={deliveryDate || addDays(today, 2)}
                      onChange={(event) => setDeliveryDate(event.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                  <Field label="Como" htmlFor="order-fulfilment">
                    <Select value={fulfilment} onValueChange={(value) => setFulfilment(value as FulfilmentType)}>
                      <SelectTrigger id="order-fulfilment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FULFILMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="subtle" size="sm" onClick={() => setConverting(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      convertToOrder(quote.id, deliveryDate || addDays(today, 2), fulfilment);
                      setConverting(false);
                    }}
                  >
                    Criar encomenda
                  </Button>
                </div>
              </DetailSection>
            )}
          </ScrollArea>
        )}

        {quote && (
          <SheetFooter className="flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => setPrintId(quote.id)}>
                Imprimir / PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => duplicateQuote(quote.id)}>
                Duplicar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {quote.status === "Rascunho" && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={quote.lines.length === 0 || status === "Expirada"}
                  onClick={() => setQuoteStatus(quote.id, "Enviada")}
                >
                  Marcar como enviada
                </Button>
              )}
              {quote.status === "Enviada" && status !== "Expirada" && (
                <>
                  <Button variant="subtle" size="sm" onClick={() => setQuoteStatus(quote.id, "Recusada")}>
                    Recusada
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => setQuoteStatus(quote.id, "Rascunho")}>
                    Reabrir
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setQuoteStatus(quote.id, "Aceite")}>
                    Aceite
                  </Button>
                </>
              )}
              {quote.status === "Aceite" && !converting && (
                <Button variant="primary" size="sm" onClick={() => setConverting(true)}>
                  Converter em encomenda
                </Button>
              )}
              {quote.status === "Convertida" && quote.orderId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    openQuote(null);
                    openOrder(quote.orderId!);
                  }}
                >
                  Ver encomenda
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
