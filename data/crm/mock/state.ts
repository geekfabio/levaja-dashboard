import { OPPORTUNITIES, type Opportunity } from "@/data/opportunities";
import { TICKETS, type Ticket } from "@/data/tickets";

export type CrmState = {
  tickets: Ticket[];
  opportunities: Opportunity[];
};

export function createSeedState(): CrmState {
  return structuredClone({
    tickets: TICKETS,
    opportunities: OPPORTUNITIES,
  });
}
