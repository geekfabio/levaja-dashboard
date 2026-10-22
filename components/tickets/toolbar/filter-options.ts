import { OWNERS } from "@/data/companies";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/data/tickets";
import { ALL_ASSIGNEES, ANY_PRIORITY, ANY_STATUS } from "@/lib/tickets";

export const STATUS_OPTIONS = [
  { value: ANY_STATUS, label: "Qualquer estado" },
  ...TICKET_STATUSES.map((status) => ({ value: status, label: status })),
];

export const PRIORITY_OPTIONS = [
  { value: ANY_PRIORITY, label: "Qualquer prioridade" },
  ...TICKET_PRIORITIES.map((priority) => ({ value: priority, label: priority })),
];

export const ASSIGNEE_OPTIONS = [
  { value: ALL_ASSIGNEES, label: "Todos os responsáveis" },
  ...OWNERS.map((owner) => ({ value: owner.name, label: owner.name })),
];
