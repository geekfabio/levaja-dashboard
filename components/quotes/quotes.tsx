"use client";

import { useMemo } from "react";
import ModuleHeader from "@/components/_common/module-header";
import FilterMenu from "@/components/_common/filter-menu";
import TotalsBar from "@/components/_common/totals/totals-bar";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import {
  ORDER_STATUSES,
  ORDER_STATUS_TONES,
  QUOTE_STATUSES,
  QUOTE_STATUS_TONES,
} from "@/data/quotes";
import { useToday } from "@/hooks/use-today";
import { formatDateShort, formatMoney, formatMoneyCompact, formatNumber, plural } from "@/lib/format";
import { documentTotals, quoteStatus } from "@/lib/quotes";
import { useCompaniesStore } from "@/stores/companies-store";
import { useQuotesStore, type QuotesView } from "@/stores/quotes-store";
import DocumentPrint from "./document-print";
import NewQuoteDialog from "./new-quote-dialog";
import OrderDetail from "./order-detail";
import QuoteDetail from "./quote-detail";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const ALL = "all";

export default function Quotes() {
  const quotes = useQuotesStore((state) => state.quotes);
  const orders = useQuotesStore((state) => state.orders);
  const view = useQuotesStore((state) => state.view);
  const search = useQuotesStore((state) => state.search);
  const status = useQuotesStore((state) => state.status);
  const setView = useQuotesStore((state) => state.setView);
  const setSearch = useQuotesStore((state) => state.setSearch);
  const setStatus = useQuotesStore((state) => state.setStatus);
  const openQuote = useQuotesStore((state) => state.openQuote);
  const openOrder = useQuotesStore((state) => state.openOrder);
  const setNewQuoteOpen = useQuotesStore((state) => state.setNewQuoteOpen);
  const companies = useCompaniesStore((state) => state.companies);
  const today = useToday();
  const name = (id: string) => companies.find((company) => company.id === id)?.name ?? id;
  const query = search.trim().toLowerCase();

  const quoteRows = useMemo(
    () =>
      quotes.map((quote) => ({
        quote,
        status: quoteStatus(quote, today),
        total: documentTotals(quote.lines, quote.priceListDiscount).total,
      })),
    [quotes, today],
  );
  const orderRows = useMemo(
    () => orders.map((order) => ({ order, total: documentTotals(order.lines, order.priceListDiscount).total })),
    [orders],
  );

  const visibleQuotes = quoteRows.filter(
    (row) =>
      (status === ALL || row.status === status) &&
      (!query || row.quote.number.toLowerCase().includes(query) || name(row.quote.companyId).toLowerCase().includes(query)),
  );
  const visibleOrders = orderRows.filter(
    (row) =>
      (status === ALL || row.order.status === status) &&
      (!query || row.order.number.toLowerCase().includes(query) || name(row.order.companyId).toLowerCase().includes(query)),
  );

  const openQuotes = quoteRows.filter((row) => row.status === "Enviada");
  const decided = quoteRows.filter((row) => ["Aceite", "Convertida", "Recusada"].includes(row.status));
  const won = decided.filter((row) => row.status !== "Recusada");
  const pendingOrders = orderRows.filter((row) => row.order.status === "Pendente" || row.order.status === "Em preparação");
  const dueToday = pendingOrders.filter((row) => row.order.deliveryDate <= today);

  const statusOptions = [
    { value: ALL, label: "Todos os estados" },
    ...(view === "cotacoes" ? QUOTE_STATUSES : ORDER_STATUSES).map((value) => ({ value, label: value })),
  ];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Cotações" count={view === "cotacoes" ? visibleQuotes.length : visibleOrders.length}>
        <Tabs value={view} onValueChange={(value) => setView(value as QuotesView)}>
          <TabsList className="border-border overflow-x-auto border-b px-4 *:whitespace-nowrap">
            <TabsTrigger value="cotacoes">Cotações · {quotes.length}</TabsTrigger>
            <TabsTrigger value="encomendas">Encomendas · {pendingOrders.length} em curso</TabsTrigger>
          </TabsList>
        </Tabs>
      </ModuleHeader>

      <TotalsBar
        id="cotacoes"
        summary={`${plural(openQuotes.length, "cotação enviada", "cotações enviadas")} · ${plural(pendingOrders.length, "encomenda em curso", "encomendas em curso")}`}
        items={[
          {
            key: "enviadas",
            label: "À espera do cliente",
            value: formatMoneyCompact(openQuotes.reduce((sum, row) => sum + row.total, 0)),
            fullValue: formatMoney(openQuotes.reduce((sum, row) => sum + row.total, 0)),
            hint: plural(openQuotes.length, "cotação enviada", "cotações enviadas"),
          },
          {
            key: "taxa",
            label: "Taxa de aceitação",
            value: decided.length ? `${Math.round((won.length / decided.length) * 100)}%` : "—",
            hint: `${formatNumber(won.length)} de ${formatNumber(decided.length)} decididas`,
          },
          {
            key: "encomendas",
            label: "Encomendas em curso",
            value: formatMoneyCompact(pendingOrders.reduce((sum, row) => sum + row.total, 0)),
            fullValue: formatMoney(pendingOrders.reduce((sum, row) => sum + row.total, 0)),
            hint: plural(pendingOrders.length, "encomenda", "encomendas"),
          },
          {
            key: "hoje",
            label: "Entregas até hoje",
            value: formatNumber(dueToday.length),
            tone: dueToday.length > 0 ? "warning" : undefined,
            hint: "por entregar",
          },
        ]}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Pesquisar cotações e encomendas"
            data-page-search
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Número ou cliente…"
            className="h-[30px] w-full sm:w-[220px]"
          />
          <FilterMenu label="Estado" value={status} options={statusOptions} onChange={setStatus} />
        </div>
        <Button variant="primary" size="sm" onClick={() => setNewQuoteOpen(true)}>
          <PlusIcon aria-hidden className="size-3" />
          Nova cotação
        </Button>
      </div>

      <ScrollArea orientation="both" className="min-h-0 flex-1">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>{view === "cotacoes" ? "Válida até" : "Entrega"}</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total com IVA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view === "cotacoes" &&
              visibleQuotes.map(({ quote, status: rowStatus, total }) => (
                <TableRow key={quote.id} onClick={() => openQuote(quote.id)} className="hover:bg-card/60 cursor-pointer">
                  <TableCell>
                    <span className="flex flex-col gap-1">
                      <Button
                        variant="link"
                        size="none"
                        className="justify-start font-medium no-underline tabular-nums"
                        onClick={(event) => {
                          event.stopPropagation();
                          openQuote(quote.id);
                        }}
                      >
                        {quote.number}
                      </Button>
                      <span className="caption-style text-subtle">
                        {formatDateShort(quote.createdAt)} · {plural(quote.lines.length, "produto", "produtos")}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">{name(quote.companyId)}</TableCell>
                  <TableCell className="text-soft tabular-nums">{formatDateShort(quote.validUntil)}</TableCell>
                  <TableCell>
                    <Tag tone={QUOTE_STATUS_TONES[rowStatus]}>{rowStatus}</Tag>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(total)}</TableCell>
                </TableRow>
              ))}
            {view === "encomendas" &&
              visibleOrders.map(({ order, total }) => (
                <TableRow key={order.id} onClick={() => openOrder(order.id)} className="hover:bg-card/60 cursor-pointer">
                  <TableCell>
                    <span className="flex flex-col gap-1">
                      <Button
                        variant="link"
                        size="none"
                        className="justify-start font-medium no-underline tabular-nums"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOrder(order.id);
                        }}
                      >
                        {order.number}
                      </Button>
                      <span className="caption-style text-subtle">{order.fulfilment}</span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">{name(order.companyId)}</TableCell>
                  <TableCell className="text-soft tabular-nums">{formatDateShort(order.deliveryDate)}</TableCell>
                  <TableCell>
                    <Tag tone={ORDER_STATUS_TONES[order.status]}>{order.status}</Tag>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(total)}</TableCell>
                </TableRow>
              ))}
            {(view === "cotacoes" ? visibleQuotes.length : visibleOrders.length) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="caption-style text-subtle py-10 text-center">
                  {view === "cotacoes" ? "Sem cotações para estes filtros." : "Sem encomendas para estes filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <NewQuoteDialog />
      <QuoteDetail />
      <OrderDetail />
      <DocumentPrint />
    </section>
  );
}
