import type { Repositories } from "../repositories";
import { createMockDatabase } from "./database";
import { createMockCompanies } from "./companies";
import { createMockDocuments } from "./documents";
import { createMockOpportunities } from "./opportunities";
import { createMockTickets } from "./tickets";

export function createMockRepositories(options: { latencyMs?: number } = {}): Repositories {
  const db = createMockDatabase(options.latencyMs ?? 0);
  return {
    tickets: createMockTickets(db),
    opportunities: createMockOpportunities(db),
    companies: createMockCompanies(options.latencyMs ?? 0),
    documents: createMockDocuments(options.latencyMs ?? 0),
  };
}
