import type { Repositories } from "../repositories";
import { createMockDatabase } from "./database";
import { createMockOpportunities } from "./opportunities";
import { createMockTickets } from "./tickets";

export function createMockRepositories(options: { latencyMs?: number } = {}): Repositories {
  const db = createMockDatabase(options.latencyMs ?? 0);
  return {
    tickets: createMockTickets(db),
    opportunities: createMockOpportunities(db),
  };
}
