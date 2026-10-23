"use client";

import { useEffect, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { TRANSACTION_STATUS_TONES } from "@/components/admin/shared/status-badge";
import { TRANSACTION_KIND_LABELS, TRANSACTION_STATUS_LABELS } from "@/lib/leva-ja/services";
import { errorMessage, repositories } from "@/data/leva-ja";
import type { TransactionFilters } from "@/data/leva-ja";
import { useTransactions } from "@/hooks/admin/use-finance";
import { downloadCsv } from "@/lib/csv";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";
import type { Transaction } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

const KIND_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(TRANSACTION_KIND_LABELS) as Transaction["kind"][]).map((kind) => ({ value: kind, label: TRANSACTION_KIND_LABELS[kind] }))];
const STATUS_OPTIONS = [{ value: "all", label: "Todos" }, ...(Object.keys(TRANSACTION_STATUS_LABELS) as Transaction["status"][]).map((status) => ({ value: status, label: TRANSACTION_STATUS_LABELS[status] }))];

export default function TransactionsPanel({ today }: { today: string }) {
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const filters: Omit<TransactionFilters, "page" | "pageSize"> = {
    kind: kind === "all" ? undefined : [kind as Transaction["kind"]],
    status: status === "all" ? undefined : [status as Transaction["status"]],
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };
  const list = useTransactions({ ...filters, page, pageSize: 20 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await repositories().finance.exportTransactions(filters);
      downloadCsv(`transaccoes-leva-ja-${today}.csv`, [
        ["Data", "Prestador", "Descrição", "Tipo", "Estado", "Valor (Kz)"],
        ...rows.map((row) => [formatDateTimeNumeric(row.at), row.providerName, row.title, TRANSACTION_KIND_LABELS[row.kind], TRANSACTION_STATUS_LABELS[row.status], row.amount]),
      ]);
      toast({ title: "Exportação concluída", description: `${rows.length} transacções exportadas para CSV.`, tone: "success" });
    } catch (error) {
      toast({ title: "Não foi possível exportar", description: errorMessage(error), tone: "danger" });
    } finally {
      setExporting(false);
    }
  }

  const reset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[300px]">
          <span className="sr-only">Pesquisar por prestador ou descrição</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Prestador ou descrição" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
        </label>
        <FilterMenu label="Tipo" value={kind} options={KIND_OPTIONS} onChange={reset(setKind)} />
        <FilterMenu label="Estado" value={status} options={STATUS_OPTIONS} onChange={reset(setStatus)} />
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
        empty={{ title: "Sem transacções", description: "Não há transacções com estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Transacções" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Data</TableHead>
                    <TableHead scope="col">Prestador</TableHead>
                    <TableHead scope="col">Descrição</TableHead>
                    <TableHead scope="col">Tipo</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(row.at)}</TableCell>
                      <TableCell>{row.providerName}</TableCell>
                      <TableCell className="text-soft max-w-[260px] truncate">{row.title}</TableCell>
                      <TableCell className="text-soft">{TRANSACTION_KIND_LABELS[row.kind]}</TableCell>
                      <TableCell>
                        <Tag tone={TRANSACTION_STATUS_TONES[row.status]} size="sm">
                          {TRANSACTION_STATUS_LABELS[row.status]}
                        </Tag>
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", row.amount < 0 ? "text-danger" : "text-success")}>
                        {row.amount > 0 ? "+" : ""}
                        {formatKz(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das transacções" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
    </div>
  );
}
