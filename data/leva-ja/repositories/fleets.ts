import type { Fleet, ProviderAccount } from "@/types/leva-ja";
import type { Page, PageQuery } from "./common";

export type FleetFilters = PageQuery & { status?: Fleet["status"][]; q?: string };

export type FleetStats = { drivers: number; online: number; completed30: number; volume30: number; rating: number | null };

export type FleetSummary = Fleet & { stats: FleetStats };

export type FleetDetail = FleetSummary & { drivers: ProviderAccount[] };

export type FleetInput = Pick<Fleet, "name" | "nif" | "contactName" | "phone" | "email">;

export interface FleetsRepository {
  list(filters?: FleetFilters): Promise<Page<FleetSummary>>;
  get(id: string): Promise<FleetDetail>;
  create(input: FleetInput): Promise<Fleet>;
  addDriver(id: string, providerId: string): Promise<FleetDetail>;
  removeDriver(id: string, providerId: string, reason: string): Promise<FleetDetail>;
  setStatus(id: string, status: Fleet["status"], reason: string): Promise<Fleet>;
}
