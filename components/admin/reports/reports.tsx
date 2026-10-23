"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import type { ReportColumnFormat, ReportKind } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { useReport } from "@/hooks/admin/use-commerce";
import { downloadCsv } from "@/lib/csv";
import { formatDecimal, formatKz, formatNumber, formatPercentDecimal, luandaDay, shiftDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

const REPORT_OPTIONS: { value: ReportKind; label: string; description: string }[] = [
  { value: "operations", label: "Operação", description: "Pedidos por dia, concluídos, cancelados e agendados." },
  { value: "finance", label: "Finanças", description: "Volume, taxas, comissões, reembolsos e receita líquida por dia." },
  { value: "providers", label: "Prestadores", description: "Serviços, cancelamentos, ganhos e avaliação de cada prestador." },
  { value: "zones", label: "Zonas", description: "Pedidos, volume, valor médio e prestadores activos por zona." },
  { value: "business", label: "Contas empresariais", description: "Pedidos, desconto, valor a facturar e dívida de cada empresa." },
];

function format(value: string | number | null, kind: ReportColumnFormat) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (kind === "kz") return formatKz(value);
  if (kind === "percent") return formatPercentDecimal(value);
  if (kind === "decimal") return formatDecimal(value, 1);
  return formatNumber(value);
}

export default function Reports() {
  const now = useClock();
  const today = luandaDay(new Date(now));
  const [kind, setKind] = useState<ReportKind>("operations");
  const [from, setFrom] = useState(() => shiftDay(today, -29));
  const [to, setTo] = useState(today);
  const report = useReport(kind, { from, to });
  const option = REPORT_OPTIONS.find((item) => item.value === kind) ?? REPORT_OPTIONS[0];

  function exportCsv() {
    const data = report.data;
    if (!data) return;
    downloadCsv(`relatorio-${data.kind}-${data.from}-${data.to}.csv`, [data.columns.map((column) => column.label), ...data.rows.map((row) => row.map((cell) => cell ?? ""))]);
    toast({ title: "Relatório exportado", description: `${data.rows.length} linha(s) em CSV.`, tone: "success" });
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Relatórios" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenu label="Relatório" value={kind} options={REPORT_OPTIONS} onChange={(value) => setKind(value as ReportKind)} />
            <label className="caption-style text-subtle flex items-center gap-2">
              De
              <Input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} className="h-[30px] w-[150px] text-[13px]" />
            </label>
            <label className="caption-style text-subtle flex items-center gap-2">
              Até
              <Input type="date" value={to} min={from} max={today} onChange={(event) => event.target.value && setTo(event.target.value)} className="h-[30px] w-[150px] text-[13px]" />
            </label>
            <Button variant="secondary" size="sm" className="ml-auto" onClick={exportCsv} disabled={!report.data}>
              <ShareIcon aria-hidden className="size-3.5" />
              Exportar CSV
            </Button>
          </div>
          <p className="caption-style text-soft">{option.description}</p>
          <AsyncState query={report} skeleton={<Skeleton className="h-96 rounded-xl" />} errorDescription={errorMessage}>
            {(data) => (
              <div className={cn("flex flex-col gap-4", report.isPlaceholderData && "opacity-60")}>
                <SummaryTiles tiles={data.summary.map((item) => ({ label: item.label, value: typeof item.value === "number" ? item.value : 0, display: format(item.value, item.format) }))} />
                <div className="border-border bg-card overflow-x-auto rounded-xl border">
                  <Table aria-label={`Relatório de ${option.label.toLowerCase()}`}>
                    <TableHeader>
                      <TableRow>
                        {data.columns.map((column) => (
                          <TableHead key={column.key} scope="col" className={column.format === "text" ? undefined : "text-right"}>
                            {column.label.replace(" (Kz)", "").replace(" (%)", "")}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={data.columns.length} className="text-subtle">
                            Sem dados neste período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.rows.map((row, index) => (
                          <TableRow key={index}>
                            {row.map((cell, column) => (
                              <TableCell key={data.columns[column].key} className={data.columns[column].format === "text" ? undefined : "text-right tabular-nums"}>
                                {format(cell, data.columns[column].format)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
    </section>
  );
}
