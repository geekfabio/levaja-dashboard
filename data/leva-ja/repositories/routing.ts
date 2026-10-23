import type { RouteResult } from "@/lib/leva-ja/routing";
import type { Coordinates, VehicleClass } from "@/types/leva-ja";

export type { RouteLeg, RouteResult } from "@/lib/leva-ja/routing";

export type RouteOptions = { vehicleClass?: VehicleClass };

export interface RoutingRepository {
  route(points: Coordinates[], options?: RouteOptions): Promise<RouteResult>;
}
