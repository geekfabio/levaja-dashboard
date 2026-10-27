import type { Repositories } from "../repositories";
import { createMockTickets } from "./tickets";

export function createMockRepositories(options: { latencyMs?: number } = {}): Repositories {
  return {
    tickets: createMockTickets(options.latencyMs ?? 0),
  };
}
