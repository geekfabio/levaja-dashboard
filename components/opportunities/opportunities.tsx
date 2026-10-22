"use client";

import { useMemo } from "react";
import Button from "@/components/_ui/button";
import OpportunitiesHeader from "./header/header";
import OpportunitiesToolbar from "./toolbar/toolbar";
import OpportunitiesTotals from "./opportunities-totals";
import KanbanBoard from "./kanban/kanban-board";
import OpportunitiesTable from "./table/opportunities-table";
import OpportunityDetail from "./detail/opportunity-detail";
import NewOpportunityDialog from "./new-opportunity/new-opportunity-dialog";
import LossReasonDialog from "./loss-reason-dialog";
import { filterOpportunities } from "@/lib/opportunities";
import { nowLuandaLocal } from "@/lib/format";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

export default function Opportunities() {
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const owner = useOpportunitiesStore((state) => state.owner);
  const stage = useOpportunitiesStore((state) => state.stage);
  const search = useOpportunitiesStore((state) => state.search);
  const overdue = useOpportunitiesStore((state) => state.overdue);
  const setOverdue = useOpportunitiesStore((state) => state.setOverdue);
  const view = useOpportunitiesStore((state) => state.view);

  const visible = useMemo(
    () =>
      filterOpportunities(
        opportunities,
        { owner, stage, search, overdue },
        nowLuandaLocal().slice(0, 10),
      ),
    [opportunities, owner, stage, search, overdue],
  );

  return (
    <section
      id="opportunities"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <OpportunitiesHeader count={visible.length} />
      <OpportunitiesTotals opportunities={visible} />
      <OpportunitiesToolbar />
      {overdue && (
        <div
          role="status"
          className="caption-style border-line-strong text-soft mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white/3 px-4 py-2.5"
        >
          {visible.length === 0
            ? "Nenhuma oportunidade atrasada: todas as oportunidades abertas têm data de fecho no futuro."
            : `${visible.length === 1 ? "1 oportunidade aberta tem" : `${visible.length} oportunidades abertas têm`} a data prevista de fecho ultrapassada.`}
          <Button variant="ghost" size="sm" onClick={() => setOverdue(false)}>
            Ver todas
          </Button>
        </div>
      )}
      {view === "kanban" ? (
        <KanbanBoard opportunities={visible} />
      ) : (
        <OpportunitiesTable opportunities={visible} />
      )}
      <OpportunityDetail />
      <NewOpportunityDialog />
      <LossReasonDialog />
    </section>
  );
}
