import type { Repositories } from "../repositories";
import { createMockOpportunities } from "./opportunities";
import { createMockTickets } from "./tickets";

export function createMockRepositories(options: { latencyMs?: number } = {}): Repositories {
  return {
    tickets: createMockTickets(options.latencyMs ?? 0),
    opportunities: createMockOpportunities(options.latencyMs ?? 0),
  };
}
