"use client";

import { useEffect, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage, repositories } from "@/data/leva-ja";
import type { InvoiceFilters } from "@/data/leva-ja";
import { useInvoices } from "@/hooks/admin/use-billing";
import { downloadCsv } from "@/lib/csv";
import { formatDateTimeNumeric, formatKz, formatNumber } from "@/lib/format";
import { INVOICE_KIND_LABELS } from "@/lib/leva-ja/billing";
import { PAYMENT_LABELS } from "@/lib/leva-ja/services";
import { toast } from "@/stores/toast-store";
import type { InvoiceKind, PaymentMethodKind } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";
import InvoiceDialog from "./invoice-dialog";

const KIND_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(INVOICE_KIND_LABELS) as InvoiceKind[]).map((kind) => ({ value: kind, label: INVOICE_KIND_LABELS[kind] }))];
const METHOD_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(PAYMENT_LABELS) as PaymentMethodKind[]).map((method) => ({ value: method, label: PAYMENT_LABELS[method] }))];

export default function InvoicesPanel({ today }: { today: string }) {
  const [kind, setKind] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const filters: Omit<InvoiceFilters, "page" | "pageSize"> = {
    kind: kind === "all" ? undefined : [kind as InvoiceKind],
    method: method === "all" ? undefined : [method as PaymentMethodKind],
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };
  const list = useInvoices({ ...filters, page, pageSize: 20 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const reset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await repositories().billing.exportInvoices(filters);
      downloadCsv(`facturas-leva-ja-${today}.csv`, [
        ["Número", "Tipo", "Data", "Cliente", "Pedido", "Pagamento", "Base (Kz)", "IVA (Kz)", "Total (Kz)", "Rectifica"],
        ...rows.map((row) => [
          row.number,
          INVOICE_KIND_LABELS[row.kind],
          formatDateTimeNumeric(row.issuedAt),
          row.clientName,
          row.requestCode,
          PAYMENT_LABELS[row.paymentMethod],
          row.net,
          row.vat,
          row.total,
          row.relatedNumber ?? "",
        ]),
      ]);
      toast({ title: "Exportação concluída", description: `${rows.length} documentos exportados para CSV.`, tone: "success" });
    } catch (error) {
      toast({ title: "Não foi possível exportar", description: errorMessage(error), tone: "danger" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[300px]">
          <span className="sr-only">Pesquisar por número, pedido ou cliente</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Número, pedido ou cliente" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
        </label>
        <FilterMenu label="Tipo" value={kind} options={KIND_OPTIONS} onChange={reset(setKind)} />
        <FilterMenu label="Pagamento" value={method} options={METHOD_OPTIONS} onChange={reset(setMethod)} />
        <label className="caption-style text-subtle flex items-center gap-2">
          De
          <Input type="date" value={from} max={to || undefined} onChange={(event) => reset(setFrom)(event.target.value)} className="h-[30px] w-[150px] text-[13px]" />
        </label>
        <label className="caption-style text-subtle flex items-center gap-2">
          Até
          <Input type="date" value={to} min={from || undefined} onChange={(event) => reset(setTo)(event.target.value)} className="h-[30px] w-[150px] text-[13px]" />
        </label>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={exportCsv} disabled={exporting}>
          <ShareIcon aria-hidden className="size-3.5" />
          {exporting ? "A exportar…" : "Exportar CSV"}
        </Button>
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem documentos", description: "Não há facturas nem notas de crédito com estes filtros." }}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <dl className="caption-style text-soft flex flex-wrap gap-x-6 gap-y-1 tabular-nums" aria-label="Totais dos documentos filtrados">
              <div className="flex gap-1.5">
                <dt>Documentos</dt>
                <dd className="text-foreground font-medium">{formatNumber(data.totals.count)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Facturado</dt>
                <dd className="text-foreground font-medium">{formatKz(data.totals.invoiced)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Creditado</dt>
                <dd className="text-foreground font-medium">{formatKz(data.totals.credited)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>IVA liquidado</dt>
                <dd className="text-foreground font-medium">{formatKz(data.totals.vat)}</dd>
              </div>
            </dl>
            <div className="border-border bg-card flex flex-col rounded-xl border">
              <div className="overflow-x-auto">
                <Table aria-label="Facturas e notas de crédito" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Número</TableHead>
                      <TableHead scope="col">Tipo</TableHead>
                      <TableHead scope="col">Emitido</TableHead>
                      <TableHead scope="col">Cliente</TableHead>
                      <TableHead scope="col">Pedido</TableHead>
                      <TableHead scope="col">Pagamento</TableHead>
                      <TableHead scope="col" className="text-right">
                        IVA
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Button variant="link" size="none" onClick={() => setOpenId(invoice.id)} className="tabular-nums">
                            {invoice.number}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={invoice.kind === "invoice" ? "neutral" : "warning"} label={INVOICE_KIND_LABELS[invoice.kind]} />
                        </TableCell>
                        <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(invoice.issuedAt)}</TableCell>
                        <TableCell>{invoice.clientName}</TableCell>
                        <TableCell className="tabular-nums">{invoice.requestCode}</TableCell>
                        <TableCell className="text-soft">{PAYMENT_LABELS[invoice.paymentMethod]}</TableCell>
                        <TableCell className="text-soft text-right tabular-nums">{formatKz(invoice.vat)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatKz(invoice.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação dos documentos" className="border-border border-t" />
            </div>
          </div>
        )}
      </AsyncState>
      <InvoiceDialog invoiceId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
