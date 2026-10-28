import type { Automation, AutomationStatus } from "@/data/automations";
import type { AutomationsRepository } from "../repositories/automations";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpAutomations(http: HttpClient): AutomationsRepository {
  return {
    list: () => http.get<Automation[]>("/crm/automations"),
    create: () => http.post<Automation>("/crm/automations", {}),
    remove: (automationId) => http.post<Automation>(`/crm/automations/${id(automationId)}/remove`, {}),
    setStatus: (automationId, status: AutomationStatus) => http.post<Automation>(`/crm/automations/${id(automationId)}/status`, { status }),
  };
}
