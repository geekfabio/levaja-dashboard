import { readAdminCsrfToken } from "@/data/leva-ja/http";
import type { Repositories } from "../repositories";
import { createHttpClient } from "./client";
import { createHttpCompanies } from "./companies";
import { createHttpActivities } from "./activities";
import { createHttpAutomations } from "./automations";
import { createHttpCampaigns } from "./campaigns";
import { createHttpContacts } from "./contacts";
import { createHttpConversations } from "./conversations";
import { createHttpDocuments } from "./documents";
import { createHttpOffers } from "./offers";
import { createHttpOpportunities } from "./opportunities";
import { createHttpTickets } from "./tickets";

export type CrmHttpRepositoriesOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
};

export function createHttpRepositories(options: CrmHttpRepositoriesOptions): Repositories {
  const http = createHttpClient(options.baseUrl, options.fetch, () => readAdminCsrfToken(options.storage ?? null));
  return {
    tickets: createHttpTickets(http),
    opportunities: createHttpOpportunities(http),
    companies: createHttpCompanies(http),
    documents: createHttpDocuments(http),
    contacts: createHttpContacts(http),
    conversations: createHttpConversations(http),
    activities: createHttpActivities(http),
    campaigns: createHttpCampaigns(http),
    automations: createHttpAutomations(http),
    offers: createHttpOffers(http),
  };
}
