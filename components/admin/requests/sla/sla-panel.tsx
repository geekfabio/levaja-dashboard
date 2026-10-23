"use client";

import { useState } from "react";
import BarLineChart from "@/components/_common/charts/bar-line-chart";
import ChartCard from "@/components/_common/charts/chart-card";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import type { SlaStats } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { useSla } from "@/hooks/admin/use-operations";
import { formatDateNumeric, formatDateShort, formatDateTimeNumeric, formatNumber, formatPercent, luandaDay, shiftDay } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

function rate(stats: SlaStats) {
  return stats.withinRate === null ? "—" : formatPercent(stats.withinRate * 100);
}

function tone(stats: SlaStats) {
  if (stats.withinRate === null) return "neutral" as const;
  return stats.withinRate >= 0.9 ? ("success" as const) : stats.withinRate >= 0.75 ? ("warning" as const) : ("danger" as const);
}

function StatsCells({ stats }: { stats: SlaStats }) {
  return (
    <>
      <TableCell>
        <ToneBadge tone={tone(stats)} label={rate(stats)} />
      </TableCell>
      <TableCell className="text-soft text-right tabular-nums">{stats.average === null ? "—" : `${formatNumber(stats.average)} min`}</TableCell>
    </>
  );
}

export default function SlaPanel() {
  const now = useClock();
  const today = luandaDay(new Date(now));
  const [period, setPeriod] = useState("7");
  const report = useSla({ from: shiftDay(today, -(Number(period) - 1)), to: today });

  return (
    <div className="flex flex-col gap-5">
      <FilterMenu label="Período" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} className="self-start" />
      <AsyncState query={report} skeleton={<Skeleton className="h-96 rounded-xl" />} errorDescription={errorMessage}>
        {(data) => (
          <div className={report.isPlaceholderData ? "flex flex-col gap-5 opacity-60" : "flex flex-col gap-5"}>
            <SummaryTiles
              tiles={[
                { label: `Atribuídos em até ${data.targets.assign} min`, value: (data.assign.withinRate ?? 0) * 100, display: rate(data.assign) },
                { label: "Atribuição · percentil 90", value: data.assign.p90 ?? 0, display: data.assign.p90 === null ? "—" : `${formatNumber(data.assign.p90)} min` },
                { label: `Chegadas em até ${data.targets.arrival} min`, value: (data.arrival.withinRate ?? 0) * 100, display: rate(data.arrival) },
                { label: "Chegada · percentil 90", value: data.arrival.p90 ?? 0, display: data.arrival.p90 === null ? "—" : `${formatNumber(data.arrival.p90)} min` },
              ]}
            />
            <ChartCard
              title="Pedidos dentro do prazo por dia"
              description="Barras: percentagem atribuída dentro do prazo. Linha: percentagem com chegada dentro do prazo."
              table={{
                columns: ["Dia", "Pedidos", "Atribuição no prazo", "Chegada no prazo"],
                rows: data.daily.map((day) => [
                  formatDateNumeric(day.date),
                  day.count,
                  day.assignWithin === null ? "—" : formatPercent(day.assignWithin * 100),
                  day.arrivalWithin === null ? "—" : formatPercent(day.arrivalWithin * 100),
                ]),
              }}
            >
              <BarLineChart
                points={data.daily.map((day) => ({
                  key: day.date,
                  label: formatDateShort(day.date),
                  title: formatDateNumeric(day.date),
                  bar: Math.round((day.assignWithin ?? 0) * 100),
                  line: Math.round((day.arrivalWithin ?? 0) * 100),
                }))}
                ariaLabel="Percentagem de pedidos dentro do prazo por dia"
                barLabel="Atribuição no prazo"
                lineLabel="Chegada no prazo"
                format={(value) => formatPercent(value)}
                formatAxis={(value) => formatPercent(value)}
              />
            </ChartCard>
            <div className="grid gap-4 xl:grid-cols-2">
              <SettingsPanel title="Por zona" className="bg-card">
                <div className="overflow-x-auto">
                  <Table aria-label="Prazos por zona">
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Zona</TableHead>
                        <TableHead scope="col">Atribuição</TableHead>
                        <TableHead scope="col" className="text-right">
                          Média
                        </TableHead>
                        <TableHead scope="col">Chegada</TableHead>
                        <TableHead scope="col" className="text-right">
                          Média
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byZone.map((zone) => (
                        <TableRow key={zone.zoneId}>
                          <TableCell>{zone.zoneName}</TableCell>
                          <StatsCells stats={zone.assign} />
                          <StatsCells stats={zone.arrival} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SettingsPanel>
              <SettingsPanel title="Por serviço" className="bg-card">
                <div className="overflow-x-auto">
                  <Table aria-label="Prazos por serviço">
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Serviço</TableHead>
                        <TableHead scope="col">Atribuição</TableHead>
                        <TableHead scope="col" className="text-right">
                          Média
                        </TableHead>
                        <TableHead scope="col">Chegada</TableHead>
                        <TableHead scope="col" className="text-right">
                          Média
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byService.map((service) => (
                        <TableRow key={service.kind}>
                          <TableCell>{SERVICE_SHORT_LABELS[service.kind]}</TableCell>
                          <StatsCells stats={service.assign} />
                          <StatsCells stats={service.arrival} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SettingsPanel>
            </div>
            <SettingsPanel title="Pedidos fora do prazo" description="Os 40 mais recentes no período." className="bg-card">
              {data.breaches.length === 0 ? (
                <p className="caption-style text-subtle">Todos os pedidos cumpriram os prazos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table aria-label="Pedidos fora do prazo">
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Pedido</TableHead>
                        <TableHead scope="col">Zona</TableHead>
                        <TableHead scope="col">Prazo falhado</TableHead>
                        <TableHead scope="col" className="text-right">
                          Tempo
                        </TableHead>
                        <TableHead scope="col">Criado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.breaches.map((breach) => (
                        <TableRow key={`${breach.requestId}-${breach.metric}`}>
                          <TableCell>
                            <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${breach.requestId}`}>
                              {breach.code}
                            </Button>
                            <span className="caption-style text-subtle block pt-0.5">{SERVICE_SHORT_LABELS[breach.kind]}</span>
                          </TableCell>
                          <TableCell className="text-soft">{breach.zoneName}</TableCell>
                          <TableCell>{breach.metric === "assign" ? "Atribuição" : "Chegada"}</TableCell>
                          <TableCell className="text-danger text-right tabular-nums">
                            {formatNumber(breach.minutes)} min (meta {formatNumber(breach.target)})
                          </TableCell>
                          <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(breach.at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SettingsPanel>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
