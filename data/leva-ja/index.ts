import type { Repositories } from "./repositories";
import { createHttpRepositories } from "./http";

let instance: Repositories | null = null;

/** Mesmo domínio que o painel (ver Dockerfile). Em desenvolvimento, NEXT_PUBLIC_API_URL=http://localhost:4000. */
export const DEFAULT_API_URL = "/api";

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function repositories(): Repositories {
  if (instance) return instance;
  instance = createHttpRepositories({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
    routingUrl: process.env.NEXT_PUBLIC_ROUTING_URL,
    storage: browserStorage(),
  });
  return instance;
}

export * from "./repositories";
