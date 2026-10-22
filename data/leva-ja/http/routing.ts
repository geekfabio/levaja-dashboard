import { VEHICLE_DURATION_FACTOR, estimateRoute, roundKm, routeKey } from "@/lib/leva-ja/routing";
import type { RouteResult } from "@/lib/leva-ja/routing";
import type { Coordinates } from "@/types/leva-ja";
import type { RoutingRepository } from "../repositories/routing";

export const DEFAULT_ROUTING_URL = "https://router.project-osrm.org";

export type OsrmRoutingOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  cacheSize?: number;
};

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: { distance: number; duration: number }[];
  }[];
};

export function parseOsrmRoute(body: OsrmResponse, factor = 1): RouteResult | null {
  const route = body.code === "Ok" ? body.routes?.[0] : undefined;
  const coordinates = route?.geometry?.coordinates;
  if (!route || !coordinates || coordinates.length < 2) return null;
  return {
    distanceKm: roundKm(route.distance / 1000),
    durationMin: Math.max(1, Math.round((route.duration / 60) * factor)),
    geometry: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    legs: (route.legs ?? []).map((leg) => ({
      distanceKm: roundKm(leg.distance / 1000),
      durationMin: Math.max(1, Math.round((leg.duration / 60) * factor)),
    })),
    source: "road",
  };
}

export function createOsrmRouting(options: OsrmRoutingOptions = {}): RoutingRepository {
  const base = (options.baseUrl ?? DEFAULT_ROUTING_URL).replace(/\/+$/, "");
  const run = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 8000;
  const cacheSize = options.cacheSize ?? 200;
  const cache = new Map<string, Promise<RouteResult>>();

  async function fetchRoute(points: Coordinates[], factor: number) {
    const path = points.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(";");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await run(`${base}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseOsrmRoute((await response.json()) as OsrmResponse, factor);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    route(points, routeOptions = {}) {
      if (points.length < 2) return Promise.resolve(estimateRoute(points, routeOptions.vehicleClass));
      const key = routeKey(points, routeOptions.vehicleClass);
      const cached = cache.get(key);
      if (cached) return cached;
      const factor = routeOptions.vehicleClass ? VEHICLE_DURATION_FACTOR[routeOptions.vehicleClass] : 1;
      const pending = fetchRoute(points, factor).then((result) => {
        if (result) return result;
        cache.delete(key);
        return estimateRoute(points, routeOptions.vehicleClass);
      });
      cache.set(key, pending);
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
      return pending;
    },
  };
}
