import { createSeedState, type CrmState } from "./state";

export type CrmMockDatabase = {
  state: CrmState;
  run: <T>(fn: (state: CrmState) => T) => Promise<T>;
};

export function createMockDatabase(latencyMs: number): CrmMockDatabase {
  const state = createSeedState();
  return {
    state,
    run: async (fn) => {
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      return structuredClone(fn(state));
    },
  };
}
