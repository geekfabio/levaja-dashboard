import type { ServiceKind, ServiceRequest } from "@/types/leva-ja";
import type { DateRange } from "./common";

export type ScheduledFilters = { state?: "unassigned" | "assigned" | "risk" | "all"; days?: number; zone?: string[] };

export type ScheduledReport = {
  items: ServiceRequest[];
  totals: { today: number; next7: number; unassigned: number; risk: number };
};

export type SlaStats = { count: number; withinRate: number | null; average: number | null; p90: number | null; breaches: number };

export type SlaBreach = {
  requestId: string;
  code: string;
  kind: ServiceKind;
  zoneName: string;
  metric: "assign" | "arrival";
  minutes: number;
  target: number;
  at: string;
};

export type SlaReport = {
  from: string;
  to: string;
  targets: { assign: number; arrival: number };
  assign: SlaStats;
  arrival: SlaStats;
  byZone: { zoneId: string; zoneName: string; assign: SlaStats; arrival: SlaStats }[];
  byService: { kind: ServiceKind; assign: SlaStats; arrival: SlaStats }[];
  daily: { date: string; assignWithin: number | null; arrivalWithin: number | null; count: number }[];
  breaches: SlaBreach[];
};

export type HeatmapQuery = { kind: "demand" | "supply"; days: number; hour?: number | null };

export type HeatPoint = { latitude: number; longitude: number; weight: number };

export type HeatmapReport = {
  points: HeatPoint[];
  max: number;
  zones: { zoneId: string; zoneName: string; demand: number; supply: number; ratio: number | null }[];
};

export interface OperationsRepository {
  scheduled(filters?: ScheduledFilters): Promise<ScheduledReport>;
  sla(range: Required<DateRange>): Promise<SlaReport>;
  heatmap(query: HeatmapQuery): Promise<HeatmapReport>;
}
