import type { Repositories } from "../repositories";
import { createHttpClient } from "./client";
import { createHttpTickets } from "./tickets";

export function createHttpRepositories(options: { baseUrl: string; fetch?: typeof fetch }): Repositories {
  const http = createHttpClient(options.baseUrl, options.fetch);
  return {
    tickets: createHttpTickets(http),
  };
}
