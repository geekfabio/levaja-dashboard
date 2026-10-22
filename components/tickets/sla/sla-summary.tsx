"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import type { Ticket } from "@/data/tickets";
import { formatNumber, plural } from "@/lib/format";
import { slaSummary } from "@/lib/sla";
import type { SlaFilter } from "@/lib/tickets";
import { useTicketsStore } from "@/stores/tickets-store";

type SlaSummaryProps = {
  tickets: Ticket[];
  now: number | null;
};

export default function SlaSummary({ tickets, now }: SlaSummaryProps) {
  const sla = useTicketsStore((state) => state.sla);
  const setSla = useTicketsStore((state) => state.setSla);
  const summary = slaSummary(tickets, now);
  const pending = now === null;

  function filterTile(filter: SlaFilter) {
    return {
      pressed: sla === filter,
      onSelect: () => setSla(sla === filter ? "todos" : filter),
    };
  }

  return (
    <TotalsBar
      id="tickets"
      summary={`${formatNumber(summary.open)} por resolver · ${pending ? "—" : plural(summary.breached, "atrasado", "atrasados")}`}
      items={[
        { key: "total", label: "Tickets", value: formatNumber(tickets.length) },
        { key: "abertos", label: "Por resolver", value: formatNumber(summary.open), hint: "tickets em aberto", ...filterTile("abertos") },
        {
          key: "risco",
          label: "Em risco",
          value: pending ? "—" : formatNumber(summary.risk),
          hint: "menos de 25% do prazo",
          tone: summary.risk > 0 ? "warning" : undefined,
          ...filterTile("risco"),
        },
        {
          key: "atrasados",
          label: "Atrasados",
          value: pending ? "—" : formatNumber(summary.breached),
          hint: "prazo de SLA ultrapassado",
          tone: summary.breached > 0 ? "danger" : undefined,
          ...filterTile("atrasados"),
        },
        {
          key: "cumprimento",
          label: "Cumprimento",
          value: summary.compliance === null ? "—" : `${summary.compliance}%`,
          hint: "dos tickets resolvidos",
        },
      ]}
    />
  );
}
