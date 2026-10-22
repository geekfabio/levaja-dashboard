import type { DataSource, Repositories } from "./repositories";
import { createHttpRepositories, createOsrmRouting } from "./http";
import { createMockRepositories } from "./mock";

let instance: Repositories | null = null;

export const DEFAULT_API_URL = "http://localhost:4000/api";

export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock";
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function repositories(): Repositories {
  if (instance) return instance;
  instance =
    dataSource() === "http"
      ? createHttpRepositories({
          baseUrl: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
          routingUrl: process.env.NEXT_PUBLIC_ROUTING_URL,
          storage: browserStorage(),
        })
      : createMockRepositories({ storage: browserStorage(), routing: createOsrmRouting({ baseUrl: process.env.NEXT_PUBLIC_ROUTING_URL }) });
  return instance;
}

export * from "./repositories";
