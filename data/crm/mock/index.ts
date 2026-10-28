import type { Repositories } from "../repositories";
import { createMockDatabase } from "./database";
import { createMockCompanies } from "./companies";
import { createMockActivities } from "./activities";
import { createMockContacts } from "./contacts";
import { createMockConversations } from "./conversations";
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
    contacts: createMockContacts(options.latencyMs ?? 0),
    conversations: createMockConversations(options.latencyMs ?? 0),
    activities: createMockActivities(options.latencyMs ?? 0),
  };
}
