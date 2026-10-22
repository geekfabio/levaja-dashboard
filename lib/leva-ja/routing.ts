import { distanceKm } from "./eligibility";
import type { Coordinates, ServiceRequest, ServiceStatus, VehicleClass } from "@/types/leva-ja";

export type RouteLeg = { distanceKm: number; durationMin: number };

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  geometry: Coordinates[];
  legs: RouteLeg[];
  source: "road" | "estimate";
};

export const ROAD_FACTOR = 1.35;
export const URBAN_SPEED_KMH = 28;

export const VEHICLE_DURATION_FACTOR: Record<VehicleClass, number> = {
  pickup: 1,
  van: 1.1,
  truck: 1.25,
  tow_truck: 1.25,
};

export function roundKm(value: number) {
  return Math.round(value * 10) / 10;
}

export function estimateRoute(points: Coordinates[], vehicleClass?: VehicleClass): RouteResult {
  const factor = vehicleClass ? VEHICLE_DURATION_FACTOR[vehicleClass] : 1;
  const legs = points.slice(1).map((point, index) => {
    const km = distanceKm(points[index], point) * ROAD_FACTOR;
    return { distanceKm: roundKm(km), durationMin: Math.max(1, Math.round((km / URBAN_SPEED_KMH) * 60 * factor)) };
  });
  return {
    distanceKm: roundKm(legs.reduce((sum, leg) => sum + leg.distanceKm, 0)),
    durationMin: legs.reduce((sum, leg) => sum + leg.durationMin, 0),
    geometry: points,
    legs,
    source: "estimate",
  };
}

export function routeKey(points: Coordinates[], vehicleClass?: VehicleClass) {
  return `${vehicleClass ?? "any"}:${points.map((point) => `${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`).join(";")}`;
}

const APPROACH_STATUSES: readonly ServiceStatus[] = ["assigned", "en_route"];

export type RoutePlan = { approach: Coordinates[] | null; trip: Coordinates[] };

export function routePlan(request: Pick<ServiceRequest, "status" | "origin" | "stops" | "destination" | "provider">): RoutePlan {
  const trip = [request.origin.coords, ...request.stops.map((stop) => stop.coords), request.destination.coords];
  const provider = request.provider?.coords;
  if (provider && APPROACH_STATUSES.includes(request.status)) return { approach: [provider, request.origin.coords], trip };
  if (provider && request.status === "in_transit") return { approach: null, trip: [provider, request.destination.coords] };
  return { approach: null, trip };
}
