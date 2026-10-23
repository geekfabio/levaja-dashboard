"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import RequestStatusBadge from "@/components/admin/shared/status-badge";
import { ErrorState } from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { errorMessage } from "@/data/leva-ja";
import { useProviderPositions } from "@/hooks/admin/use-providers";
import { useActiveRequests } from "@/hooks/admin/use-requests";
import { useZones } from "@/hooks/admin/use-zones";
import { useHeatmap } from "@/hooks/admin/use-operations";
import FilterMenu from "@/components/_common/filter-menu";
import { useClock } from "@/hooks/admin/use-clock";
import { formatDecimal, formatElapsed, formatNumber } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/leva-ja/status";
import { cn } from "@/lib/utils";
import type { VehicleClass } from "@/types/leva-ja";
import OsmMap from "./osm-map/osm-map";
import { VEHICLE_ICONS } from "./osm-map/map-marker";
import type { MapMarker } from "./osm-map/map-marker";
import RouteSummary from "./route-summary";
import { useRequestRoute } from "./use-request-route";

const LEGEND = [
  { label: "Viatura livre", className: "ring-brand-vivid bg-card ring-2" },
  { label: "Viatura em serviço", className: "ring-info bg-card ring-2" },
  { label: "À procura de prestador", className: "bg-warning" },
  { label: "Pedido em curso", className: "bg-info" },
];

const HEAT_OPTIONS = [
  { value: "off", label: "Desligado" },
  { value: "demand", label: "Procura (7 dias)" },
  { value: "supply", label: "Oferta (agora)" },
];

const HOUR_OPTIONS = [{ value: "all", label: "Todas" }, ...Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: `${String(hour).padStart(2, "0")}:00` }))];

const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  tow_truck: "Reboque",
  pickup: "Pickup",
  van: "Carrinha",
  truck: "Camião",
};

function VehicleIcon({ vehicleClass }: { vehicleClass: VehicleClass }) {
  const Icon = VEHICLE_ICONS[vehicleClass];
  return <Icon aria-hidden className="size-3.5 shrink-0" />;
}

export default function OperationalMap() {
  const requests = useActiveRequests();
  const positions = useProviderPositions();
  const zones = useZones();
  const now = useClock();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(true);
  const [showRequests, setShowRequests] = useState(true);
  const [onlyFree, setOnlyFree] = useState(false);
  const [focus, setFocus] = useState<string>("initial");
  const [heatKind, setHeatKind] = useState<"off" | "demand" | "supply">("off");
  const [heatHour, setHeatHour] = useState("all");
  const heatmap = useHeatmap({ kind: heatKind === "supply" ? "supply" : "demand", days: 7, hour: heatHour === "all" ? null : Number(heatHour) }, heatKind !== "off");

  const active = requests.data ?? [];
  const providers = positions.data ?? [];
  const selectedRequest = active.find((request) => request.id === selectedId);
  const selectedProvider = providers.find((provider) => provider.id === selectedId);
  const route = useRequestRoute(selectedRequest);
  const freeCount = providers.filter((provider) => !provider.activeRequestId).length;
  const visibleProviders = providers.filter((provider) => !onlyFree || !provider.activeRequestId);
  const markers: MapMarker[] = [
    ...(showRequests
      ? active
          .filter((request) => request.id !== selectedId || !selectedRequest)
          .map((request) => ({
            id: request.id,
            kind: "request" as const,
            coords: request.status === "in_transit" && request.provider ? request.provider.coords : request.origin.coords,
            tone: STATUS_TONES[request.status],
            label: `${request.code}, ${SERVICE_SHORT_LABELS[request.kind]}, ${STATUS_LABELS[request.status]}, ${request.origin.area}`,
          }))
      : []),
    ...route.markers,
    ...(showProviders
      ? visibleProviders.map((provider) => ({
          id: provider.id,
          kind: "vehicle" as const,
          coords: provider.coords,
          vehicleClass: provider.vehicleClass,
          busy: Boolean(provider.activeRequestId),
          label: `${provider.name}, ${VEHICLE_CLASS_LABELS[provider.vehicleClass]} ${provider.vehicleLabel}${provider.activeRequestId ? ", em serviço" : ", livre"}`,
        }))
      : []),
  ];

  function select(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    if (active.some((request) => request.id === id)) setFocus(id);
  }

  const loading = requests.isPending || positions.isPending;
  const failed = requests.isError || positions.isError;
  const updatedAt = Math.max(requests.dataUpdatedAt, positions.dataUpdatedAt);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader
        title="Mapa operacional"
        badge={
          <span className="caption-style text-subtle hidden items-center gap-1.5 sm:flex" aria-live="polite">
            <span aria-hidden className="bg-brand-vivid size-2 animate-pulse rounded-full motion-reduce:animate-none" />
            {updatedAt ? (now - updatedAt < 60_000 ? "Actualizado agora mesmo" : `Actualizado há ${formatElapsed(new Date(updatedAt).toISOString(), now)}`) : "A ligar…"}
          </span>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ul className="flex flex-wrap items-center gap-4" aria-label="Legenda">
              {LEGEND.map((item) => (
                <li key={item.label} className="caption-style text-soft flex items-center gap-1.5">
                  <span aria-hidden className={cn("size-2.5 rounded-full", item.className)} />
                  {item.label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-4">
              <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
                <Checkbox checked={showProviders} onCheckedChange={(value) => setShowProviders(value === true)} />
                Viaturas ({formatNumber(providers.length)})
              </label>
              <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
                <Checkbox checked={onlyFree} onCheckedChange={(value) => setOnlyFree(value === true)} disabled={!showProviders} />
                Só livres ({formatNumber(freeCount)})
              </label>
              <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
                <Checkbox checked={showRequests} onCheckedChange={(value) => setShowRequests(value === true)} />
                Pedidos ({formatNumber(active.length)})
              </label>
              <FilterMenu label="Mapa de calor" value={heatKind} options={HEAT_OPTIONS} onChange={(value) => setHeatKind(value as typeof heatKind)} />
              {heatKind === "demand" && <FilterMenu label="Hora" value={heatHour} options={HOUR_OPTIONS} onChange={setHeatHour} />}
            </div>
          </div>
          <div className="border-border relative min-h-0 flex-1 overflow-hidden rounded-xl border">
            {loading ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : failed ? (
              <ErrorState
                description={errorMessage(requests.error ?? positions.error)}
                onRetry={() => {
                  requests.refetch();
                  positions.refetch();
                }}
              />
            ) : (
              <OsmMap
                markers={markers}
                routes={route.routes}
                zones={zones.data ?? []}
                fit={focus === "initial" ? undefined : route.points}
                fitKey={focus}
                ariaLabel="Mapa de Angola com as viaturas disponíveis e os pedidos activos. Use Tab para percorrer os marcadores."
                selectedId={selectedId}
                onSelect={select}
                heat={heatKind !== "off" && heatmap.data ? { ...heatmap.data, tone: heatKind } : null}
                className="absolute inset-0"
              />
            )}
          </div>
        </div>

        <aside aria-label="Pedidos activos" className="border-border flex min-h-0 w-full shrink-0 flex-col border-t lg:w-[360px] lg:border-t-0 lg:border-l">
          {(selectedRequest || selectedProvider) && (
            <div className="border-border flex flex-col gap-2 border-b p-4" aria-live="polite">
              {selectedRequest ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="lead-style font-medium">{selectedRequest.code}</span>
                    <RequestStatusBadge status={selectedRequest.status} />
                  </div>
                  <span className="caption-style text-soft">
                    {SERVICE_SHORT_LABELS[selectedRequest.kind]} · {selectedRequest.origin.area} → {selectedRequest.destination.area}
                  </span>
                  <span className="caption-style text-subtle">
                    {selectedRequest.client?.name} · {selectedRequest.provider?.name ?? "sem prestador"}
                  </span>
                  <RouteSummary legs={route.legs} className="pt-1" />
                  <Button variant="secondary" size="sm" href={`${SECTION_ROUTES.requests}/${selectedRequest.id}`} className="self-start">
                    Abrir pedido
                  </Button>
                </>
              ) : selectedProvider ? (
                <>
                  <span className="lead-style font-medium">{selectedProvider.name}</span>
                  <span className="caption-style text-soft flex items-center gap-1.5">
                    <VehicleIcon vehicleClass={selectedProvider.vehicleClass} />
                    {VEHICLE_CLASS_LABELS[selectedProvider.vehicleClass]} · {selectedProvider.vehicleLabel}
                  </span>
                  <span className="caption-style text-subtle">
                    {selectedProvider.activeRequestId ? "Em serviço" : "Livre"} · {selectedProvider.services.map((service) => SERVICE_SHORT_LABELS[service]).join(", ")}
                  </span>
                  {selectedProvider.activeRequestId && (
                    <Button variant="secondary" size="sm" href={`${SECTION_ROUTES.requests}/${selectedProvider.activeRequestId}`} className="self-start">
                      Abrir pedido em curso
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          )}
          {heatKind !== "off" && heatmap.data && (
            <div className="border-border flex flex-col gap-2 border-b p-4" aria-live="polite">
              <h2 className="eyebrow-style text-faint font-normal">
                {heatKind === "demand" ? `Procura por prestador · 7 dias${heatHour === "all" ? "" : ` · ${heatHour}h`}` : "Oferta agora"}
              </h2>
              <ul className="flex flex-col gap-1">
                {heatmap.data.zones.slice(0, 5).map((zone) => (
                  <li key={zone.zoneId} className="caption-style flex justify-between gap-2 tabular-nums">
                    <span className="text-soft">{zone.zoneName}</span>
                    <span>
                      {formatNumber(zone.demand)} pedidos · {formatNumber(zone.supply)} prestadores
                      {zone.ratio === null ? " · sem cobertura" : ` · ${formatDecimal(zone.ratio, 1)} por prestador`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h2 className="eyebrow-style text-faint px-4 pt-4 pb-2 font-normal">Pedidos activos</h2>
          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : active.length === 0 ? (
              <p className="caption-style text-subtle px-4 py-6">Não há pedidos activos neste momento.</p>
            ) : (
              <ul className="divide-border flex flex-col divide-y px-2 pb-4">
                {active.map((request) => (
                  <li key={request.id}>
                    <Button
                      variant="item"
                      size="none"
                      aria-pressed={selectedId === request.id}
                      onClick={() => select(request.id)}
                      className="aria-pressed:bg-muted items-center justify-between gap-3 px-2 py-2.5"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="lead-style truncate">
                          {request.code} · {SERVICE_SHORT_LABELS[request.kind]}
                        </span>
                        <span className="caption-style text-subtle truncate">
                          {request.origin.area} · há {formatElapsed(request.createdAt, now)}
                        </span>
                      </span>
                      <RequestStatusBadge status={request.status} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </aside>
      </div>
    </section>
  );
}
