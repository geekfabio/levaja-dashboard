"use client";

import { useRoute } from "@/hooks/admin/use-route";
import { routePlan } from "@/lib/leva-ja/routing";
import type { Coordinates, ServiceRequest } from "@/types/leva-ja";
import type { MapMarker } from "./osm-map/map-marker";
import type { MapRoute } from "./osm-map/osm-map";
import type { RouteSummaryLeg } from "./route-summary";

const SNAP = 500;

function snap(point: Coordinates): Coordinates {
  return { latitude: Math.round(point.latitude * SNAP) / SNAP, longitude: Math.round(point.longitude * SNAP) / SNAP };
}

type RoutableRequest = Pick<ServiceRequest, "id" | "status" | "origin" | "stops" | "destination" | "provider">;

export function useRequestRoute(request: RoutableRequest | undefined) {
  const raw = request ? routePlan(request) : { approach: null, trip: [] };
  const plan = {
    approach: raw.approach ? [snap(raw.approach[0]), ...raw.approach.slice(1)] : null,
    trip: request?.status === "in_transit" && raw.trip.length === 2 ? [snap(raw.trip[0]), raw.trip[1]] : raw.trip,
  };
  const vehicleClass = request?.provider?.vehicle.vehicleClass;
  const approach = useRoute(plan.approach ?? [], vehicleClass);
  const trip = useRoute(plan.trip, vehicleClass);

  if (!request) return { markers: [] as MapMarker[], routes: [] as MapRoute[], legs: [] as RouteSummaryLeg[], points: [] };

  const inTransit = request.status === "in_transit" && plan.trip.length === 2 && Boolean(request.provider);
  const stopNames = inTransit
    ? ["Posição actual", request.destination.area]
    : [request.origin.area, ...request.stops.map((stop) => stop.area), request.destination.area];

  const markers: MapMarker[] = [
    { id: `${request.id}-origin`, kind: "origin", coords: request.origin.coords, label: `Recolha: ${request.origin.label}, ${request.origin.area}` },
    ...request.stops.map((stop) => ({ id: stop.id, kind: "stop" as const, coords: stop.coords, label: `Paragem: ${stop.label}, ${stop.area}` })),
    {
      id: `${request.id}-destination`,
      kind: "destination",
      coords: request.destination.coords,
      label: `Entrega: ${request.destination.label}, ${request.destination.area}`,
    },
  ];

  const routes: MapRoute[] = [];
  if (plan.approach) routes.push({ id: `${request.id}-approach`, points: approach.data?.geometry ?? plan.approach, tone: "brand", dashed: true });
  routes.push({ id: `${request.id}-trip`, points: trip.data?.geometry ?? plan.trip, tone: "info" });

  const legs: RouteSummaryLeg[] = [];
  if (plan.approach) {
    legs.push({ id: "approach", label: "Prestador até à recolha", dashed: true, route: approach.data, loading: approach.isFetching });
  }
  legs.push({
    id: "trip",
    label: inTransit ? "Posição actual até à entrega" : request.stops.length ? `Recolha → ${request.stops.length} paragem(ns) → entrega` : "Recolha até à entrega",
    route: trip.data,
    loading: trip.isFetching,
    stops: stopNames,
  });

  const points = [...(plan.approach ?? []), ...plan.trip, ...(trip.data?.geometry ?? [])];
  return { markers, routes, legs, points };
}
