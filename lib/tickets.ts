import type { Ticket } from "@/data/tickets";
import { ticketSla } from "./sla";

export const ANY_STATUS = "any";
export const ANY_PRIORITY = "any";
export const ALL_ASSIGNEES = "all";

export const SLA_FILTERS = ["todos", "abertos", "risco", "atrasados"] as const;

export type SlaFilter = (typeof SLA_FILTERS)[number];

export type TicketFilters = {
  status: string;
  priority: string;
  assignee: string;
  search: string;
  sla: SlaFilter;
};

export const DEFAULT_FILTERS: TicketFilters = {
  status: ANY_STATUS,
  priority: ANY_PRIORITY,
  assignee: ALL_ASSIGNEES,
  search: "",
  sla: "todos",
};

export function filterTickets(
  tickets: Ticket[],
  { status, priority, assignee, search, sla }: TicketFilters,
  now: number | null,
): Ticket[] {
  const query = search.trim().toLowerCase();

  return tickets.filter((ticket) => {
    if (status !== ANY_STATUS && ticket.status !== status) return false;
    if (priority !== ANY_PRIORITY && ticket.priority !== priority) return false;
    if (assignee !== ALL_ASSIGNEES && ticket.assignee !== assignee) return false;
    if (sla !== "todos") {
      const clock = ticketSla(ticket, now);
      if (sla === "abertos" && (clock.state === "met" || clock.state === "missed")) return false;
      if (sla === "risco" && clock.state !== "risk") return false;
      if (sla === "atrasados" && clock.state !== "breached") return false;
    }
    if (
      query &&
      !ticket.subject.toLowerCase().includes(query) &&
      !(ticket.companyName ?? "").toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });
}
