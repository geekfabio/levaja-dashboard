import type { OpportunitiesRepository } from "./opportunities";
import type { TicketsRepository } from "./tickets";

export type DataSource = "mock" | "http";

export interface Repositories {
  tickets: TicketsRepository;
  opportunities: OpportunitiesRepository;
}

export * from "./errors";
export * from "./tickets";
export * from "./opportunities";
