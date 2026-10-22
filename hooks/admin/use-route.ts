"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import { routeKey } from "@/lib/leva-ja/routing";
import type { Coordinates, VehicleClass } from "@/types/leva-ja";

export function useRoute(points: Coordinates[], vehicleClass?: VehicleClass) {
  return useQuery({
    queryKey: ["routing", routeKey(points, vehicleClass)],
    queryFn: () => repositories().routing.route(points, { vehicleClass }),
    enabled: points.length >= 2,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}
