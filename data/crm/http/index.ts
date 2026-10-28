import type { Repositories } from "../repositories";
import { createHttpClient } from "./client";
import { createHttpCompanies } from "./companies";
import { createHttpDocuments } from "./documents";
import { createHttpOpportunities } from "./opportunities";
import { createHttpTickets } from "./tickets";

export function createHttpRepositories(options: { baseUrl: string; fetch?: typeof fetch }): Repositories {
  const http = createHttpClient(options.baseUrl, options.fetch);
  return {
    tickets: createHttpTickets(http),
    opportunities: createHttpOpportunities(http),
    companies: createHttpCompanies(http),
    documents: createHttpDocuments(http),
  };
}
