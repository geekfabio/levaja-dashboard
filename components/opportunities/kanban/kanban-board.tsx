"use client";

import { useState, type DragEvent } from "react";
import { ScrollArea } from "@/components/_ui/scroll-area";
import KanbanColumn from "./kanban-column";
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from "@/data/opportunities";
import { groupByStage } from "@/lib/opportunities";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

type KanbanBoardProps = {
  opportunities: Opportunity[];
};

export default function KanbanBoard({ opportunities }: KanbanBoardProps) {
  const openDetail = useOpportunitiesStore((state) => state.openDetail);
  const requestStageMove = useOpportunitiesStore(
    (state) => state.requestStageMove,
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<OpportunityStage | null>(
    null,
  );

  const groups = groupByStage(opportunities);

  function handleCardDragStart(event: DragEvent<HTMLDivElement>, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, stage: OpportunityStage) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggingId;
    setDragOverStage(null);
    setDraggingId(null);
    if (id) requestStageMove(id, stage);
  }

  return (
    <ScrollArea orientation="both" className="min-h-0 flex-1">
      <div className="flex min-w-max gap-3 p-4">
        {OPPORTUNITY_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            opportunities={groups.get(stage) ?? []}
            isDragOver={dragOverStage === stage}
            onDragEnter={() => setDragOverStage(stage)}
            onDragLeave={() =>
              setDragOverStage((current) => (current === stage ? null : current))
            }
            onDrop={(event) => handleDrop(event, stage)}
            onOpenCard={openDetail}
            onCardDragStart={handleCardDragStart}
            onCardDragEnd={() => {
              setDraggingId(null);
              setDragOverStage(null);
            }}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
