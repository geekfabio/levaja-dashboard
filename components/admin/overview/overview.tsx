"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import AsyncState from "@/components/_common/async-state";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { errorMessage } from "@/data/leva-ja";
import { useAttention, useOverview } from "@/hooks/admin/use-metrics";
import { useClock } from "@/hooks/admin/use-clock";
import { luandaDay, shiftDay } from "@/lib/format";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import OverviewKpis from "./kpis/overview-kpis";
import OverviewCharts from "./charts/overview-charts";
import AttentionList from "./attention/attention-list";

type Period = "today" | "week";

const PERIODS: { key: Period; label: string; previous: string }[] = [
  { key: "today", label: "Hoje", previous: "vs. ontem" },
  { key: "week", label: "Últimos 7 dias", previous: "vs. 7 dias anteriores" },
];

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {Array.from({ length: 9 }, (_, index) => (
        <Skeleton key={index} className="h-[118px] rounded-xl" />
      ))}
    </div>
  );
}

export default function Overview() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const now = useClock();
  const today = luandaDay(new Date(now));
  const [period, setPeriod] = useState<Period>("today");
  const current = PERIODS.find((item) => item.key === period) ?? PERIODS[0];
  const kpiRange = { from: period === "today" ? today : shiftDay(today, -6), to: today };
  const chartRange = { from: shiftDay(today, -29), to: today };
  const kpis = useOverview(kpiRange);
  const charts = useOverview(chartRange);
  const attention = useAttention();

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader
        title="Visão geral"
        actions={
          <div role="group" aria-label="Período dos indicadores" className="bg-muted hidden rounded-full p-0.5 sm:flex">
            {PERIODS.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                size="sm"
                aria-pressed={period === item.key}
                onClick={() => setPeriod(item.key)}
                className="aria-pressed:bg-secondary aria-pressed:text-foreground px-3"
              >
                {item.label}
              </Button>
            ))}
          </div>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 p-5">
          <div role="group" aria-label="Período dos indicadores" className="bg-muted flex self-start rounded-full p-0.5 sm:hidden">
            {PERIODS.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                size="sm"
                aria-pressed={period === item.key}
                onClick={() => setPeriod(item.key)}
                className="aria-pressed:bg-secondary aria-pressed:text-foreground px-3"
              >
                {item.label}
              </Button>
            ))}
          </div>

          <AsyncState query={kpis} skeleton={<KpiSkeleton />} errorDescription={errorMessage}>
            {(data) => <OverviewKpis kpis={data.kpis} previous={data.previous} periodLabel={current.previous} />}
          </AsyncState>

          <SettingsPanel
            title="Precisa de atenção"
            description="Pedidos parados, alertas SOS, documentos e levantamentos à espera da equipa."
            className="bg-card"
          >
            <AsyncState
              query={attention}
              skeleton={
                <div className="grid gap-6 md:grid-cols-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-40" />
                  ))}
                </div>
              }
              errorDescription={errorMessage}
            >
              {(data) => (role ? <AttentionList items={data} role={role} now={now} /> : null)}
            </AsyncState>
          </SettingsPanel>

          <AsyncState
            query={charts}
            skeleton={
              <div className="grid gap-4 xl:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-[340px] rounded-xl" />
                ))}
              </div>
            }
            errorDescription={errorMessage}
          >
            {(data) => <OverviewCharts overview={data} />}
          </AsyncState>
        </div>
      </ScrollArea>
    </section>
  );
}
