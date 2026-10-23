"use client";

import OsmMap from "@/components/admin/map/osm-map/osm-map";
import type { MapMarker } from "@/components/admin/map/osm-map/map-marker";
import RouteSummary from "@/components/admin/map/route-summary";
import { useRequestRoute } from "@/components/admin/map/use-request-route";
import { formatKm, formatMinutes } from "@/lib/format";
import { isActive } from "@/lib/leva-ja/status";
import type { ServiceRequest, Zone } from "@/types/leva-ja";

export default function RequestRoute({ request, zones }: { request: ServiceRequest; zones: Zone[] }) {
  const route = useRequestRoute(request);
  const markers: MapMarker[] = [...route.markers];
  if (request.provider && isActive(request.status)) {
    markers.push({
      id: request.provider.id,
      kind: "vehicle",
      coords: request.provider.coords,
      vehicleClass: request.provider.vehicle.vehicleClass,
      busy: true,
      label: `Prestador: ${request.provider.name}`,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <OsmMap
        markers={markers}
        routes={route.routes}
        zones={zones}
        fit={[...markers.map((marker) => marker.coords), ...route.points]}
        fitKey={request.id}
        ariaLabel={`Trajecto de ${request.origin.area} para ${request.destination.area}`}
        compact
        className="aspect-[4/3] w-full rounded-xl"
      />
      <RouteSummary legs={route.legs} />
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
      <p className="caption-style text-subtle tabular-nums">
        Estimativa usada no preço: {formatKm(request.distanceKm)} · cerca de {formatMinutes(request.durationMin)} de trajecto
      </p>
    </div>
  );
}
