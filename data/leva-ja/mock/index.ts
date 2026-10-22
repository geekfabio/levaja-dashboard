import type { Repositories } from "../repositories";
import { createMockAudit } from "./audit";
import { createMockAuth } from "./auth";
import { createMockClients } from "./clients";
import { MockDatabase } from "./database";
import type { MockDatabaseOptions } from "./database";
import { createMockDocuments } from "./documents";
import { createMockFinance } from "./finance";
import { createMockMetrics } from "./metrics";
import { createMockPricing } from "./pricing";
import { createMockProviders } from "./providers";
import { createMockRequests } from "./requests";
import { createMockSupport } from "./support";
import { tick } from "./ticker";
import { createMockZones } from "./zones";

export type MockRepositories = Repositories & { database: MockDatabase };

export function createMockRepositories(options: MockDatabaseOptions = {}): MockRepositories {
  const database = new MockDatabase(options);
  database.setTicker(tick);
  return {
    source: "mock",
    database,
    auth: createMockAuth(database),
    requests: createMockRequests(database),
    providers: createMockProviders(database),
    documents: createMockDocuments(database),
    clients: createMockClients(database),
    finance: createMockFinance(database),
    pricing: createMockPricing(database),
    zones: createMockZones(database),
    support: createMockSupport(database),
    metrics: createMockMetrics(database),
    audit: createMockAudit(database),
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
