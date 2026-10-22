import type { Zone } from "@/types/leva-ja";

export type ZoneInput = Omit<Zone, "id">;

export type ZoneWithStats = Zone & { providersCount: number; activeRequests: number };

export interface ZonesRepository {
  list(): Promise<ZoneWithStats[]>;
  create(input: ZoneInput, reason: string): Promise<Zone>;
  update(id: string, input: ZoneInput, reason: string): Promise<Zone>;
  remove(id: string, reason: string): Promise<void>;
}
