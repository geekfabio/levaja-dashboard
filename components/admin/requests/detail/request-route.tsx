"use client";

import LuandaMap from "@/components/admin/shared/luanda-map";
import type { MapMarker } from "@/components/admin/shared/luanda-map";
import { formatKm, formatMinutes } from "@/lib/format";
import { isActive } from "@/lib/leva-ja/status";
import type { ServiceRequest, Zone } from "@/types/leva-ja";

export default function RequestRoute({ request, zones }: { request: ServiceRequest; zones: Zone[] }) {
  const markers: MapMarker[] = [
    { id: "origin", kind: "origin", coords: request.origin.coords, label: `Recolha: ${request.origin.label}, ${request.origin.area}` },
    ...request.stops.map((stop) => ({ id: stop.id, kind: "stop" as const, coords: stop.coords, label: `Paragem: ${stop.label}, ${stop.area}` })),
    { id: "destination", kind: "destination", coords: request.destination.coords, label: `Entrega: ${request.destination.label}, ${request.destination.area}` },
  ];
  if (request.provider && isActive(request.status)) {
    markers.push({ id: request.provider.id, kind: "provider", coords: request.provider.coords, label: `Prestador: ${request.provider.name}` });
  }
  const points = [request.origin.coords, ...request.stops.map((stop) => stop.coords), request.destination.coords];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
        <LuandaMap
          markers={markers}
          routes={[{ id: "route", points, tone: "info" }]}
          zones={zones}
          fit={markers.map((marker) => marker.coords)}
          ariaLabel={`Trajecto de ${request.origin.area} para ${request.destination.area}`}
          className="absolute inset-0"
        />
      </div>
      <ol className="flex flex-col gap-2">
        <li className="flex gap-2">
          <span className="caption-style bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full font-semibold">A</span>
          <span className="lead-style min-w-0">
            {request.origin.label}
            <span className="caption-style text-subtle block pt-1">{request.origin.area}, {request.origin.city}</span>
          </span>
        </li>
        {request.stops.map((stop) => (
          <li key={stop.id} className="flex gap-2">
            <span aria-hidden className="bg-warning mx-1.5 mt-1.5 size-2 shrink-0 rounded-full" />
            <span className="lead-style min-w-0">
              {stop.label}
              <span className="caption-style text-subtle block pt-1">Paragem · {stop.area}</span>
            </span>
          </li>
        ))}
        <li className="flex gap-2">
          <span className="caption-style bg-info text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full font-semibold">B</span>
          <span className="lead-style min-w-0">
            {request.destination.label}
            <span className="caption-style text-subtle block pt-1">{request.destination.area}, {request.destination.city}</span>
          </span>
        </li>
      </ol>
      <p className="caption-style text-soft tabular-nums">
        {formatKm(request.distanceKm)} · cerca de {formatMinutes(request.durationMin)} de trajecto
      </p>
    </div>
  );
}
