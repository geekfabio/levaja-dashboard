"use client";

import { useMemo } from "react";
import ModuleHeader from "@/components/_common/module-header";
import TicketsToolbar from "./toolbar/toolbar";
import TicketsTable from "./table/tickets-table";
import TicketDetail from "./detail/ticket-detail";
import NewTicketDialog from "./new-ticket/new-ticket-dialog";
import CreateFromEmailDialog from "./from-email/create-from-email-dialog";
import SlaSummary from "./sla/sla-summary";
import { useNow } from "@/hooks/use-now";
import { sortByUrgency } from "@/lib/sla";
import { filterTickets } from "@/lib/tickets";
import { useTicketsStore } from "@/stores/tickets-store";

export default function Tickets() {
  const tickets = useTicketsStore((state) => state.tickets);
  const status = useTicketsStore((state) => state.status);
  const priority = useTicketsStore((state) => state.priority);
  const assignee = useTicketsStore((state) => state.assignee);
  const search = useTicketsStore((state) => state.search);
  const sla = useTicketsStore((state) => state.sla);
  const now = useNow();

  const visible = useMemo(
    () =>
      sortByUrgency(
        filterTickets(tickets, { status, priority, assignee, search, sla }, now),
        now,
      ),
    [tickets, status, priority, assignee, search, sla, now],
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Tickets" count={visible.length} />
      <SlaSummary tickets={tickets} now={now} />
      <TicketsToolbar />
      <TicketsTable tickets={visible} now={now} />
      <TicketDetail />
      <NewTicketDialog />
      <CreateFromEmailDialog />
    </section>
  );
}
