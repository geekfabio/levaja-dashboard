import type { DataSource, Repositories } from "./repositories";
import { createMockRepositories } from "./mock";

let instance: Repositories | null = null;

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
  instance = createMockRepositories({ storage: browserStorage() });
  return instance;
}

export * from "./repositories";
