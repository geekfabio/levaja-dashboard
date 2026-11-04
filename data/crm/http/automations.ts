import type { Automation, AutomationStatus } from "@/data/automations";
import type { AutomationsRepository } from "../repositories/automations";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpAutomations(http: HttpClient): AutomationsRepository {
  return {
    list: () => http.get<Automation[]>("/crm/automations"),
    create: () => http.post<Automation>("/crm/automations", {}),
    remove: (automationId) => http.del<Automation>(`/crm/automations/${id(automationId)}`),
    setStatus: (automationId, status: AutomationStatus) => http.patch<Automation>(`/crm/automations/${id(automationId)}/status`, { status }),
  };
}
