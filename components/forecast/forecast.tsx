"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import ModuleHeader from "@/components/_common/module-header";
import FilterMenu, { type FilterOption } from "@/components/_common/filter-menu";
import StatTile from "@/components/_common/stat-tile";
import AtRiskList from "@/components/_common/at-risk-list";
import { ScrollArea } from "@/components/_ui/scroll-area";
import HeroFigure from "./charts/hero-figure";
import FunnelChart from "./charts/funnel-chart";
import RecentOpportunitiesList from "./charts/recent-opportunities-list";
import ChartCard from "./dashboard/chart-card";
import DailySalesChart from "./dashboard/daily-sales-chart";
import ChannelStackChart, { CHANNEL_COLORS } from "./dashboard/channel-stack-chart";
import PaymentDonut from "./dashboard/payment-donut";
import HeatmapChart from "./dashboard/heatmap-chart";
import CategoryBars from "./dashboard/category-bars";
import ClientMatrix, { ABC_COLORS } from "./dashboard/client-matrix";
import ZoneDiverging from "./dashboard/zone-diverging";
import TargetBullets from "./dashboard/target-bullets";
import QuoteFunnel from "./dashboard/quote-funnel";
import DebtAging from "./dashboard/debt-aging";
import { SEGMENTS } from "@/data/companies";
import { SALE_CHANNELS } from "@/data/sales";
import { DEFAULT_MONTHLY_TARGET } from "@/data/commissions";
import { useToday } from "@/hooks/use-today";
import {
  ANY,
  HEATMAP_DAYS,
  categoryRevenue,
  clientMatrix,
  dailySeries,
  debtAging,
  inRange,
  paymentMix,
  percentChange,
  periodRanges,
  quoteFunnel,
  salesSummary,
  scopeSales,
  weekdayHourHeatmap,
  weeklyByChannel,
  zoneComparison,
} from "@/lib/analytics";
import { sellerResults } from "@/lib/commissions";
import { clientsAtRisk, pipelineByStage } from "@/lib/dashboard";
import { weightedPipeline } from "@/lib/opportunities";
import { compactMoneyParts, formatDateShort, formatMoney, formatPercent, plural } from "@/lib/format";
import { ease } from "@/lib/easings";
import { useCommissionsStore } from "@/stores/commissions-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useQuotesStore } from "@/stores/quotes-store";
import { useSalesStore } from "@/stores/sales-store";
import { useSettingsStore } from "@/stores/settings-store";

const PERIOD_OPTIONS: FilterOption[] = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const SEGMENT_OPTIONS: FilterOption[] = [
  { value: ANY, label: "Todos" },
  ...SEGMENTS.map((segment) => ({ value: segment, label: segment })),
];

const KPI_CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const DAY_NAMES = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: -8 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, ease: ease.power3Out }}
        className="flex flex-col gap-1"
      >
        <h2>{title}</h2>
        <p className="caption-style text-subtle max-w-[48em]">{description}</p>
      </motion.div>
      {children}
    </div>
  );
}

function deltaOf(percent: number | null, periodLabel: string, positiveIsGood = true) {
  return percent === null ? undefined : { percent, positiveIsGood, periodLabel };
}

export default function Forecast() {
  const today = useToday();
  const sales = useSalesStore((state) => state.sales);
  const companies = useCompaniesStore((state) => state.companies);
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const quotes = useQuotesStore((state) => state.quotes);
  const orders = useQuotesStore((state) => state.orders);
  const zones = useSettingsStore((state) => state.zones);
  const targets = useCommissionsStore((state) => state.targets);
  const tiers = useCommissionsStore((state) => state.tiers);

  const [days, setDays] = useState("30");
  const [zone, setZone] = useState(ANY);
  const [segment, setSegment] = useState(ANY);

  const zoneOptions = useMemo<FilterOption[]>(
    () => [{ value: ANY, label: "Todas" }, ...zones.map((item) => ({ value: item.name, label: item.name }))],
    [zones],
  );

  const data = useMemo(() => {
    const period = Number(days);
    const ranges = periodRanges(today, period);
    const scoped = scopeSales(sales, companies, { zone, segment });
    const current = inRange(scoped, ranges.current);
    const previous = inRange(scoped, ranges.previous);
    const summary = salesSummary(current);
    const before = salesSummary(previous);
    const daily = dailySeries(current, ranges.current);
    const heat = weekdayHourHeatmap(current);
    const peak = heat.reduce((best, cell) => (cell.count > best.count ? cell : best), heat[0]);
    const channels = weeklyByChannel(current, ranges.current);
    const channelTotals = SALE_CHANNELS.map((channel) => ({
      channel,
      total: channels.reduce((sum, week) => sum + week.values[channel], 0),
    }));
    const categories = categoryRevenue(current);
    const payments = paymentMix(current);
    const scopedCompanies = companies.filter(
      (company) =>
        (zone === ANY || company.zone === zone) &&
        (segment === ANY || company.tags.includes(segment as (typeof SEGMENTS)[number])),
    );
    const matrix = clientMatrix(scopedCompanies, scoped, today);
    const cooling = matrix.filter((point) => point.recency > 30 && point.abc === "A");
    const zoneRows = zoneComparison(current, previous, companies, zones.map((item) => item.name));
    const month = today.slice(0, 7);
    const monthRange = { from: `${month}-01`, to: today };
    const monthSales = inRange(scoped, monthRange);
    const sellers = sellerResults(sales, companies, month, today, (owner) => targets[owner] ?? DEFAULT_MONTHLY_TARGET, tiers).sort((a, b) => b.sold - a.sold);
    const monthTarget = sellers.reduce((sum, seller) => sum + seller.target, 0);
    const funnel = quoteFunnel(quotes, orders);
    const debt = debtAging(scoped, today);
    const overdue = debt.slice(1).reduce((sum, bucket) => sum + bucket.total, 0);
    const openOpportunities = opportunities.filter((item) => !item.stage.startsWith("Fechada"));

    return {
      period,
      ranges,
      summary,
      before,
      daily,
      heat,
      peak,
      channels,
      channelTotals,
      categories,
      payments,
      matrix,
      cooling,
      zoneRows,
      monthSales: salesSummary(monthSales).total,
      monthDaily: dailySeries(monthSales, monthRange).map((point) => point.total),
      monthTarget,
      sellers,
      funnel,
      debt,
      overdue,
      weighted: weightedPipeline(openOpportunities),
      stages: pipelineByStage(opportunities),
      risk: clientsAtRisk(scopedCompanies.filter((company) => !company.archived)),
    };
  }, [days, today, sales, companies, zone, segment, zones, targets, tiers, quotes, orders, opportunities]);

  const periodLabel = `vs ${data.period} dias anteriores`;
  const trend = data.daily.map((point) => point.average);
  const heroParts = compactMoneyParts(data.monthSales);
  const totalParts = compactMoneyParts(data.summary.total);
  const ticketParts = compactMoneyParts(data.summary.averageTicket);
  const overdueParts = compactMoneyParts(data.overdue);
  const weightedParts = compactMoneyParts(data.weighted);
  const quotaPercent = data.monthTarget ? Math.round((data.monthSales / data.monthTarget) * 100) : 0;
  const topChannel = [...data.channelTotals].sort((a, b) => b.total - a.total)[0];
  const topCategory = data.categories[0];
  const growing = data.zoneRows.filter((row) => (row.change ?? 0) > 0).length;
  const debtTotal = data.debt.reduce((sum, bucket) => sum + bucket.total, 0);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Previsão" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-10 p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros do painel">
              <FilterMenu label="Período" value={days} options={PERIOD_OPTIONS} onChange={setDays} />
              <FilterMenu label="Zona" value={zone} options={zoneOptions} onChange={setZone} />
              <FilterMenu label="Segmento" value={segment} options={SEGMENT_OPTIONS} onChange={setSegment} />
              <span className="caption-style text-subtle ml-auto">
                {formatDateShort(data.ranges.current.from)} – {formatDateShort(data.ranges.current.to)}
              </span>
            </div>

            <HeroFigure
              label="Vendas do mês"
              amount={heroParts.amount}
              suffix={heroParts.suffix}
              quotaPercent={quotaPercent}
              quotaLabel={`Objetivo da equipa: ${formatMoney(data.monthTarget)}`}
              trend={data.monthDaily.length > 1 ? data.monthDaily : [0, data.monthSales]}
            />

            <motion.div
              variants={KPI_CONTAINER_VARIANTS}
              initial="hidden"
              animate="show"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
            >
              <StatTile
                label="Vendas do período"
                value={totalParts.amount}
                decimals={1}
                suffix={totalParts.suffix}
                trend={trend}
                delta={deltaOf(percentChange(data.summary.total, data.before.total), periodLabel)}
                index={0}
              />
              <StatTile
                label="Nº de compras"
                value={data.summary.count}
                delta={deltaOf(percentChange(data.summary.count, data.before.count), periodLabel)}
                index={1}
              />
              <StatTile
                label="Ticket médio"
                value={ticketParts.amount}
                decimals={1}
                suffix={ticketParts.suffix}
                delta={deltaOf(percentChange(data.summary.averageTicket, data.before.averageTicket), periodLabel)}
                index={2}
              />
              <StatTile
                label="Clientes compradores"
                value={data.summary.buyers}
                delta={deltaOf(percentChange(data.summary.buyers, data.before.buyers), periodLabel)}
                index={3}
              />
              <StatTile
                label="Dívida com mais de 30 dias"
                value={overdueParts.amount}
                decimals={1}
                suffix={overdueParts.suffix}
                index={4}
              />
              <StatTile
                label="Carteira ponderada"
                value={weightedParts.amount}
                decimals={1}
                suffix={weightedParts.suffix}
                index={5}
              />
            </motion.div>
          </div>

          <Section title="Vendas" description="Como, quando e onde os clientes compram no período escolhido.">
            <ChartCard
              title="Vendas por dia"
              description="Colunas com o valor diário e linha com a média móvel de 7 dias, para ler a tendência sem o ruído do dia a dia."
              legend={[
                { label: "Vendas do dia", color: "var(--chart-1)" },
                { label: "Média de 7 dias", color: "var(--chart-2)" },
              ]}
              table={{
                columns: ["Dia", "Vendas", "Compras", "Média 7 dias"],
                rows: data.daily.map((point) => [formatDateShort(point.date), formatMoney(point.total), point.count, formatMoney(point.average)]),
              }}
            >
              <DailySalesChart points={data.daily} />
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="Vendas por semana e canal"
                legend={SALE_CHANNELS.map((channel) => ({ label: channel, color: CHANNEL_COLORS[channel] }))}
                insight={
                  topChannel && topChannel.total > 0 ? (
                    <>
                      <strong className="text-foreground font-medium">{topChannel.channel}</strong> lidera com{" "}
                      {formatPercent((topChannel.total / Math.max(data.summary.total, 1)) * 100)} das vendas.
                    </>
                  ) : undefined
                }
                table={{
                  columns: ["Semana", ...SALE_CHANNELS, "Total"],
                  rows: data.channels.map((week) => [
                    formatDateShort(week.week),
                    ...SALE_CHANNELS.map((channel) => formatMoney(week.values[channel])),
                    formatMoney(week.total),
                  ]),
                }}
              >
                <ChannelStackChart weeks={data.channels} />
              </ChartCard>
              <ChartCard
                title="Meios de pagamento"
                table={{
                  columns: ["Meio", "Valor", "Compras", "Peso"],
                  rows: data.payments.map((item) => [item.key, formatMoney(item.total), item.count, formatPercent(item.share * 100)]),
                }}
              >
                <PaymentDonut mix={data.payments} />
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="Quando os clientes compram"
                description="Número de compras por dia da semana e hora de caixa."
                insight={
                  data.peak && data.peak.count > 0 ? (
                    <>
                      Pico à <strong className="text-foreground font-medium">{DAY_NAMES[data.peak.day]}</strong> entre as{" "}
                      {data.peak.hour}h e as {data.peak.hour + 1}h — reforce a caixa e o armazém nesse horário.
                    </>
                  ) : undefined
                }
                table={{
                  columns: ["Dia", "Hora", "Compras", "Valor"],
                  rows: data.heat
                    .filter((cell) => cell.count > 0)
                    .map((cell) => [HEATMAP_DAYS[cell.day], `${cell.hour}h`, cell.count, formatMoney(cell.total)]),
                }}
              >
                <HeatmapChart cells={data.heat} />
              </ChartCard>
              <ChartCard
                title="Receita por categoria"
                insight={
                  topCategory && topCategory.total > 0 ? (
                    <>
                      <strong className="text-foreground font-medium">{topCategory.key}</strong> vale{" "}
                      {formatPercent(topCategory.share * 100)} da receita.
                    </>
                  ) : undefined
                }
                table={{
                  columns: ["Categoria", "Receita", "Linhas", "Peso"],
                  rows: data.categories.map((item) => [item.key, formatMoney(item.total), item.count, formatPercent(item.share * 100)]),
                }}
              >
                <CategoryBars items={data.categories} />
              </ChartCard>
            </div>
          </Section>

          <Section
            title="Clientes"
            description="Quem compra muito, quem está a esfriar e em que zonas o negócio cresce."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="Matriz de clientes"
                description="Cada ponto é um cliente: quanto mais à direita, há mais tempo sem comprar; quanto mais acima, mais compra. O tamanho mostra o nº de compras e o eixo dos dias está comprimido para separar os clientes recentes."
                legend={(["A", "B", "C"] as const).map((abc) => ({ label: `Classe ${abc}`, color: ABC_COLORS[abc] }))}
                insight={
                  data.cooling.length > 0 ? (
                    <>
                      {plural(data.cooling.length, "cliente de classe A está", "clientes de classe A estão")} há mais de 30 dias
                      sem comprar.
                    </>
                  ) : undefined
                }
                table={{
                  columns: ["Cliente", "Classe", "Dias sem comprar", "Volume 90 dias", "Compras"],
                  rows: [...data.matrix]
                    .sort((a, b) => b.volume - a.volume)
                    .map((point) => [point.company.name, point.abc, point.recency, formatMoney(point.volume), point.count]),
                }}
              >
                <ClientMatrix points={data.matrix} />
              </ChartCard>
              <ChartCard
                title="Variação por zona"
                description={`Vendas do período ${periodLabel}.`}
                legend={[
                  { label: "Cresceu", color: "var(--chart-1)" },
                  { label: "Caiu", color: "var(--chart-negative)" },
                ]}
                insight={
                  data.zoneRows.length > 0 ? (
                    <>
                      {growing} de {plural(data.zoneRows.length, "zona", "zonas")} a crescer.
                    </>
                  ) : undefined
                }
                table={{
                  columns: ["Zona", "Período", "Anterior", "Variação"],
                  rows: data.zoneRows.map((row) => [
                    row.zone,
                    formatMoney(row.current),
                    formatMoney(row.previous),
                    row.change === null ? "novo" : `${row.change > 0 ? "+" : ""}${row.change}%`,
                  ]),
                }}
              >
                <ZoneDiverging rows={data.zoneRows} />
              </ChartCard>
            </div>
          </Section>

          <Section title="Equipa comercial" description="Objetivos do mês por gestor e conversão das cotações em encomendas.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Objetivo do mês por gestor"
                description="Barra cheia: vendido. Faixa clara: projeção até ao fim do mês. Traço: objetivo."
                legend={[
                  { label: "Vendido", color: "var(--chart-1)" },
                  { label: "Projeção", color: "color-mix(in oklab, var(--chart-1) 30%, var(--card))" },
                ]}
                table={{
                  columns: ["Gestor", "Vendido", "Projeção", "Objetivo", "Atingido"],
                  rows: data.sellers.map((seller) => [
                    seller.owner,
                    formatMoney(seller.sold),
                    formatMoney(seller.projection),
                    formatMoney(seller.target),
                    formatPercent(seller.achievement),
                  ]),
                }}
              >
                <TargetBullets results={data.sellers} />
              </ChartCard>
              <ChartCard
                title="Das cotações à entrega"
                table={{
                  columns: ["Etapa", "Quantidade", "Valor"],
                  rows: data.funnel.map((step) => [step.label, step.count, formatMoney(step.value)]),
                }}
              >
                <QuoteFunnel steps={data.funnel} />
              </ChartCard>
            </div>
          </Section>

          <Section title="Carteira e cobranças" description="Oportunidades em aberto, crédito por receber e clientes que pedem atenção.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Funil de oportunidades"
                table={{
                  columns: ["Fase", "Oportunidades", "Valor"],
                  rows: data.stages.map((stage) => [stage.stage, stage.count, formatMoney(stage.value)]),
                }}
              >
                <FunnelChart stages={data.stages} />
              </ChartCard>
              <ChartCard
                title="Antiguidade da dívida"
                table={{
                  columns: ["Antiguidade", "Valor", "Vendas", "Peso"],
                  rows: data.debt.map((bucket) => [
                    bucket.label,
                    formatMoney(bucket.total),
                    bucket.count,
                    formatPercent((bucket.total / Math.max(debtTotal, 1)) * 100),
                  ]),
                }}
              >
                <DebtAging buckets={data.debt} />
              </ChartCard>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Oportunidades recentes"
                table={{
                  columns: ["Cliente", "Gestor", "Fase", "Valor"],
                  rows: opportunities.map((item) => [item.companyName, item.owner, item.stage, formatMoney(item.value)]),
                }}
              >
                <RecentOpportunitiesList opportunities={opportunities} />
              </ChartCard>
              <ChartCard
                title="Clientes em risco"
                table={{
                  columns: ["Cliente", "Gestor", "Dias sem atividade", "Carteira"],
                  rows: data.risk.map((client) => [client.name, client.owner, client.activityDays, formatMoney(client.pipelineValue)]),
                }}
              >
                <AtRiskList clients={data.risk} />
              </ChartCard>
            </div>
          </Section>
        </div>
      </ScrollArea>
    </section>
  );
}
