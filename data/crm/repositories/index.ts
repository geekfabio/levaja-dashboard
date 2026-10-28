import type { CompaniesRepository } from "./companies";
import type { ContactsRepository } from "./contacts";
import type { ConversationsRepository } from "./conversations";
import type { DocumentsRepository } from "./documents";
import type { OpportunitiesRepository } from "./opportunities";
import type { TicketsRepository } from "./tickets";

export type DataSource = "mock" | "http";

export interface Repositories {
  tickets: TicketsRepository;
  opportunities: OpportunitiesRepository;
  companies: CompaniesRepository;
  documents: DocumentsRepository;
  contacts: ContactsRepository;
  conversations: ConversationsRepository;
}

export * from "./errors";
export * from "./tickets";
export * from "./opportunities";
export * from "./companies";
export * from "./documents";
export * from "./contacts";
export * from "./conversations";
