import type { Automation, AutomationStatus } from "@/data/automations";

export interface AutomationsRepository {
  list(): Promise<Automation[]>;
  create(): Promise<Automation>;
  remove(id: string): Promise<Automation>;
  setStatus(id: string, status: AutomationStatus): Promise<Automation>;
}
