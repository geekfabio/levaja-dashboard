"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import ReassignDialog from "@/components/admin/requests/dialogs/reassign-dialog";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import RequestStatusBadge from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { errorMessage } from "@/data/leva-ja";
import type { ScheduledFilters } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { useScheduled } from "@/hooks/admin/use-operations";
import { useZones } from "@/hooks/admin/use-zones";
import { formatClock, formatDateLong, formatElapsed, formatKz, formatNumber, luandaDay } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { scheduleRisk } from "@/lib/leva-ja/scheduling";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { ServiceRequest } from "@/types/leva-ja";

const STATE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "unassigned", label: "Por atribuir" },
  { value: "assigned", label: "Com prestador" },
  { value: "risk", label: "Em risco" },
];

const DAYS_OPTIONS = [
  { value: "3", label: "Próximos 3 dias" },
  { value: "7", label: "Próximos 7 dias" },
  { value: "14", label: "Próximos 14 dias" },
];

function groupByDay(items: ServiceRequest[]) {
  const groups = new Map<string, ServiceRequest[]>();
  for (const request of items) {
    const day = luandaDay(request.scheduledFor ?? request.createdAt);
    groups.set(day, [...(groups.get(day) ?? []), request]);
  }
  return [...groups.entries()];
}

export default function Scheduled() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const now = useClock();
  const zones = useZones();
  const [state, setState] = useState("all");
  const [days, setDays] = useState("7");
  const [zone, setZone] = useState("all");
  const [assigning, setAssigning] = useState<ServiceRequest | null>(null);
  const report = useScheduled({ state: state as ScheduledFilters["state"], days: Number(days), zone: zone === "all" ? undefined : [zone] });
  if (!role) return null;
  const canOperate = hasPermission(role, "requests.operate");
  const totals = report.data?.totals;
  const today = luandaDay(new Date(now));

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Agendados" count={totals?.next7} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          <SummaryTiles
            tiles={
              totals
                ? [
                    { label: "Hoje", value: totals.today, display: formatNumber(totals.today) },
                    { label: "Próximos 7 dias", value: totals.next7, display: formatNumber(totals.next7) },
                    { label: "Por atribuir", value: totals.unassigned, display: formatNumber(totals.unassigned) },
                    { label: "Em risco (menos de 3 h sem prestador)", value: totals.risk, display: formatNumber(totals.risk) },
                  ]
                : null
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenu label="Estado" value={state} options={STATE_OPTIONS} onChange={setState} />
            <FilterMenu label="Período" value={days} options={DAYS_OPTIONS} onChange={setDays} />
            <FilterMenu label="Zona" value={zone} options={[{ value: "all", label: "Todas" }, ...(zones.data ?? []).map((item) => ({ value: item.id, label: item.name }))]} onChange={setZone} />
          </div>
          <AsyncState
            query={report}
            skeleton={<Skeleton className="h-72 rounded-xl" />}
            errorDescription={errorMessage}
            isEmpty={(data) => data.items.length === 0}
            empty={{ title: "Sem pedidos agendados", description: "Não há pedidos marcados com estes filtros." }}
          >
            {(data) => (
              <div className={report.isPlaceholderData ? "flex flex-col gap-5 opacity-60" : "flex flex-col gap-5"}>
                {groupByDay(data.items).map(([day, items]) => (
                  <section key={day} aria-label={formatDateLong(day)} className="flex flex-col gap-2">
                    <h2 className="eyebrow-style text-faint font-normal">
                      {day === today ? "Hoje · " : ""}
                      {formatDateLong(day)} · {formatNumber(items.length)} pedido(s)
                    </h2>
                    <ul className="border-border bg-card divide-border flex flex-col divide-y rounded-xl border">
                      {items.map((request) => {
                        const risk = scheduleRisk(request, now);
                        return (
                          <li key={request.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                            <span className="lead-style w-14 shrink-0 font-semibold tabular-nums">{formatClock(request.scheduledFor ?? request.createdAt)}</span>
                            <span className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                              <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${request.id}`} className="self-start">
                                {request.code} · {SERVICE_SHORT_LABELS[request.kind]}
                              </Button>
                              <span className="caption-style text-subtle">
                                {request.origin.area} → {request.destination.area} · {request.client?.name ?? "Cliente"} · {formatKz(request.price.total)}
                              </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              {request.provider ? (
                                <span className="caption-style text-soft">{request.provider.name}</span>
                              ) : (
                                <Tag tone={risk ? "red" : "amber"} size="sm">
                                  {risk ? `Sem prestador · faltam ${formatElapsed(new Date(now).toISOString(), Date.parse(request.scheduledFor ?? ""))}` : "Por atribuir"}
                                </Tag>
                              )}
                              <RequestStatusBadge status={request.status} />
                              {canOperate && (
                                <Button variant={request.provider ? "ghost" : "primary"} size="sm" onClick={() => setAssigning(request)}>
                                  {request.provider ? "Trocar prestador" : "Atribuir"}
                                </Button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </AsyncState>
        </div>
      </ScrollArea>
      {assigning && <ReassignDialog key={assigning.id} request={assigning} open onOpenChange={(open) => !open && setAssigning(null)} />}
    </section>
  );
}
