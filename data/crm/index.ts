import type { DataSource, Repositories } from "./repositories";
import { createHttpRepositories } from "./http";
import { createMockRepositories } from "./mock";

let instance: Repositories | null = null;

export const DEFAULT_API_URL = "http://localhost:4000/api";

export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock";
}

export function repositories(): Repositories {
  if (instance) return instance;
  instance =
    dataSource() === "http"
      ? createHttpRepositories({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL })
      : createMockRepositories({ latencyMs: 180 });
  return instance;
}

export * from "./repositories";
