"use client";

import ChartCard from "@/components/_common/charts/chart-card";
import StackedBarChart from "@/components/_common/charts/stacked-bar-chart";
import BarLineChart from "@/components/_common/charts/bar-line-chart";
import DonutChart from "@/components/_common/charts/donut-chart";
import FunnelBars from "@/components/_common/charts/funnel-bars";
import type { Overview } from "@/data/leva-ja";
import { formatDateNumeric, formatDateShort, formatKz, formatMoneyCompact, formatNumber } from "@/lib/format";
import { SERVICE_CHART_COLORS, SERVICE_LABELS } from "@/lib/leva-ja/services";
import { STATUS_LABELS } from "@/lib/leva-ja/status";

const REQUEST_SERIES = [
  { key: "completed", label: "Concluídos", color: "var(--chart-1)" },
  { key: "open", label: "Outros", color: "var(--chart-2)" },
  { key: "cancelled", label: "Cancelados", color: "var(--chart-negative)" },
];

export default function OverviewCharts({ overview }: { overview: Overview }) {
  const daily = overview.daily.map((point) => ({
    key: point.date,
    label: formatDateShort(point.date),
    title: formatDateNumeric(point.date),
    values: { completed: point.completed, cancelled: point.cancelled, open: point.total - point.completed - point.cancelled },
  }));
  const revenue = overview.daily.map((point) => ({
    key: point.date,
    label: formatDateShort(point.date),
    title: formatDateNumeric(point.date),
    bar: point.revenue,
  }));
  const services = overview.byService.map((item) => ({
    key: item.kind,
    label: SERVICE_LABELS[item.kind],
    value: item.count,
    color: SERVICE_CHART_COLORS[item.kind],
    detail: `${formatNumber(item.count)} pedidos · ${formatKz(item.volume)}`,
  }));
  const funnel = overview.funnel.map((step) => ({ key: step.status, label: STATUS_LABELS[step.status], count: step.count }));
  const totalRevenue = overview.daily.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Pedidos por dia"
        description="Últimos 30 dias, por resultado."
        legend={REQUEST_SERIES}
        table={{
          columns: ["Dia", "Total", "Concluídos", "Cancelados"],
          rows: overview.daily.map((point) => [formatDateNumeric(point.date), point.total, point.completed, point.cancelled]),
        }}
      >
        <StackedBarChart points={daily} series={REQUEST_SERIES} ariaLabel="Pedidos por dia nos últimos 30 dias" />
      </ChartCard>
      <ChartCard
        title="Receita da plataforma"
        description="Taxas e comissões dos pedidos pagos, por dia."
        insight={`Total no período: ${formatKz(totalRevenue)}.`}
        table={{
          columns: ["Dia", "Receita"],
          rows: overview.daily.map((point) => [formatDateNumeric(point.date), formatKz(point.revenue)]),
        }}
      >
        <BarLineChart
          points={revenue}
          ariaLabel="Receita da plataforma por dia"
          barLabel="Receita"
          format={formatKz}
          formatAxis={formatMoneyCompact}
        />
      </ChartCard>
      <ChartCard
        title="Distribuição por serviço"
        description="Número de pedidos de cada serviço no período."
        table={{
          columns: ["Serviço", "Pedidos", "Volume"],
          rows: overview.byService.map((item) => [SERVICE_LABELS[item.kind], item.count, formatKz(item.volume)]),
        }}
      >
        <DonutChart items={services} ariaLabel="Pedidos por serviço" totalLabel="Pedidos" />
      </ChartCard>
      <ChartCard
        title="Funil por estado"
        description="Quantos pedidos do período chegaram a cada estado."
        table={{ columns: ["Estado", "Pedidos"], rows: overview.funnel.map((step) => [STATUS_LABELS[step.status], step.count]) }}
      >
        <FunnelBars steps={funnel} />
      </ChartCard>
    </div>
  );
}
