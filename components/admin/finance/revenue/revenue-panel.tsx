"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ChartCard from "@/components/_common/charts/chart-card";
import ShareBars from "@/components/_common/charts/share-bars";
import StackedBarChart from "@/components/_common/charts/stacked-bar-chart";
import FilterMenu from "@/components/_common/filter-menu";
import Skeleton from "@/components/_ui/skeleton";
import { errorMessage } from "@/data/leva-ja";
import { useRevenue } from "@/hooks/admin/use-finance";
import { formatDateNumeric, formatDateShort, formatKz, formatMoneyCompact, formatNumber, shiftDay } from "@/lib/format";
import { SERVICE_CHART_COLORS, SERVICE_LABELS } from "@/lib/leva-ja/services";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
];

const SERIES = [
  { key: "commissions", label: "Comissões", color: "var(--chart-1)" },
  { key: "fees", label: "Taxas", color: "var(--chart-2)" },
];

export default function RevenuePanel({ today }: { today: string }) {
  const [days, setDays] = useState("30");
  const query = useRevenue({ from: shiftDay(today, -(Number(days) - 1)), to: today });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="caption-style text-subtle max-w-[48em]">
          Receita da plataforma = taxa por pedido + comissão sobre o valor do serviço. Só contam os pedidos pagos ou concluídos.
        </p>
        <FilterMenu label="Período" value={days} options={PERIOD_OPTIONS} onChange={setDays} align="end" />
      </div>
      <AsyncState
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        }
        errorDescription={errorMessage}
      >
        {(report) => (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Receita da plataforma", value: formatKz(report.totals.revenue) },
                { label: "Comissões", value: formatKz(report.totals.commissions) },
                { label: "Taxas", value: formatKz(report.totals.fees) },
                { label: "Volume transaccionado", value: formatKz(report.totals.volume) },
                { label: "Pedidos pagos", value: formatNumber(report.totals.count) },
              ].map((item) => (
                <div key={item.label} className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
                  <dt className="caption-style text-subtle">{item.label}</dt>
                  <dd className="text-[20px] leading-none font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <ChartCard
                title="Receita por dia"
                legend={SERIES}
                className="bg-card"
                table={{
                  columns: ["Dia", "Comissões", "Taxas", "Volume", "Pedidos"],
                  rows: report.byDay.map((point) => [formatDateNumeric(point.date), formatKz(point.commissions), formatKz(point.fees), formatKz(point.volume), point.count]),
                }}
              >
                <StackedBarChart
                  points={report.byDay.map((point) => ({
                    key: point.date,
                    label: formatDateShort(point.date),
                    title: formatDateNumeric(point.date),
                    values: { commissions: point.commissions, fees: point.fees },
                  }))}
                  series={SERIES}
                  ariaLabel="Receita da plataforma por dia, dividida em comissões e taxas"
                  format={formatKz}
                  formatAxis={formatMoneyCompact}
                  totalLabel="Receita"
                />
              </ChartCard>
              <ChartCard
                title="Receita por serviço"
                className="bg-card"
                table={{
                  columns: ["Serviço", "Receita", "Volume", "Pedidos"],
                  rows: report.byService.map((item) => [SERVICE_LABELS[item.kind], formatKz(item.fees + item.commissions), formatKz(item.volume), item.count]),
                }}
              >
                <ShareBars
                  items={report.byService.map((item) => ({
                    key: item.kind,
                    label: SERVICE_LABELS[item.kind],
                    value: item.fees + item.commissions,
                    color: SERVICE_CHART_COLORS[item.kind],
                    detail: `${formatNumber(item.count)} pedidos · volume ${formatKz(item.volume)}`,
                  }))}
                  format={formatKz}
                />
              </ChartCard>
            </div>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
