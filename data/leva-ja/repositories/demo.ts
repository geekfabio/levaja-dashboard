export type DemoSettings = { latencyMs: number; failureRate: number };

export interface DemoControls {
  settings(): DemoSettings;
  configure(settings: Partial<DemoSettings>): void;
  reset(): Promise<void>;
}
