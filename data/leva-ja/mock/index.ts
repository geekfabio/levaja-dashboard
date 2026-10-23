import type { Repositories } from "../repositories";
import { createMockApplications } from "./applications";
import { createMockAudit } from "./audit";
import { createMockAuth } from "./auth";
import { createMockBilling } from "./billing";
import { createMockBusiness } from "./business";
import { createMockClaims } from "./claims";
import { createMockClients } from "./clients";
import { createMockCommunications } from "./communications";
import { MockDatabase } from "./database";
import type { MockDatabaseOptions } from "./database";
import { createMockDisputes } from "./disputes";
import { createMockDocuments } from "./documents";
import { createMockFinance } from "./finance";
import { createMockFleets } from "./fleets";
import { createMockMetrics } from "./metrics";
import { createMockOperations } from "./operations";
import { createMockPricing } from "./pricing";
import { createMockPromotions } from "./promotions";
import { createMockProviders } from "./providers";
import { createMockQuality } from "./quality";
import { createMockRefunds } from "./refunds";
import { createMockReports } from "./reports";
import { createMockRequests } from "./requests";
import { createOsrmRouting } from "../http/routing";
import type { RoutingRepository } from "../repositories/routing";
import { createMockSettings } from "./settings";
import { createMockSupport } from "./support";
import { tick } from "./ticker";
import { createMockZones } from "./zones";

export type MockRepositories = Repositories & { database: MockDatabase };

export type MockRepositoriesOptions = MockDatabaseOptions & { routing?: RoutingRepository };

export function createMockRepositories(options: MockRepositoriesOptions = {}): MockRepositories {
  const database = new MockDatabase(options);
  database.setTicker(tick);
  return {
    source: "mock",
    database,
    auth: createMockAuth(database),
    requests: createMockRequests(database),
    operations: createMockOperations(database),
    claims: createMockClaims(database),
    disputes: createMockDisputes(database),
    refunds: createMockRefunds(database),
    providers: createMockProviders(database),
    applications: createMockApplications(database),
    fleets: createMockFleets(database),
    quality: createMockQuality(database),
    documents: createMockDocuments(database),
    clients: createMockClients(database),
    business: createMockBusiness(database),
    promotions: createMockPromotions(database),
    communications: createMockCommunications(database),
    reports: createMockReports(database),
    finance: createMockFinance(database),
    billing: createMockBilling(database),
    pricing: createMockPricing(database),
    zones: createMockZones(database),
    support: createMockSupport(database),
    metrics: createMockMetrics(database),
    audit: createMockAudit(database),
    settings: createMockSettings(database),
    routing: options.routing ?? createOsrmRouting(),
    demo: {
      settings: () => ({ ...database.settings }),
      configure: (settings) => database.configure(settings),
      reset: async () => {
        await database.delay();
        database.reset();
        const session = database.session;
        if (session) {
          database.audit(database.context(session), "demo.reset", { kind: "session", id: session.user.id, label: "Dados de demonstração" }, "Dados de demonstração repostos.");
          database.commit();
        }
      },
    },
  };
}

export { MockDatabase };
export type { MockDatabaseOptions };
