"use client";

import type { DragEvent } from "react";
import Tag from "@/components/_ui/tag";
import OpportunityCard from "./opportunity-card";
import {
  OPPORTUNITY_STAGE_TONES,
  type Opportunity,
  type OpportunityStage,
} from "@/data/opportunities";
import { formatMoney } from "@/lib/format";
import { stageTotal } from "@/lib/opportunities";
import { cn } from "@/lib/utils";

type KanbanColumnProps = {
  stage: OpportunityStage;
  opportunities: Opportunity[];
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onOpenCard: (id: string) => void;
  onCardDragStart: (event: DragEvent<HTMLDivElement>, id: string) => void;
  onCardDragEnd: () => void;
};

export default function KanbanColumn({
  stage,
  opportunities,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onOpenCard,
  onCardDragStart,
  onCardDragEnd,
}: KanbanColumnProps) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-drag-over={isDragOver}
      className={cn(
        "ease-power3-out flex w-[280px] shrink-0 flex-col gap-3 rounded-xl border border-transparent bg-white/2 p-3 transition-colors duration-150 data-[drag-over=true]:border-line-strong data-[drag-over=true]:bg-white/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Tag tone={OPPORTUNITY_STAGE_TONES[stage]}>{stage}</Tag>
        <span className="caption-style text-subtle">
          {opportunities.length}
        </span>
      </div>
      <span className="caption-style text-subtle px-1 tabular-nums">
        {formatMoney(stageTotal(opportunities))}
      </span>

      <div className="flex min-h-[60px] flex-col gap-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onOpen={() => onOpenCard(opportunity.id)}
            onDragStart={(event) => onCardDragStart(event, opportunity.id)}
            onDragEnd={onCardDragEnd}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="caption-style text-subtle flex h-[60px] items-center justify-center rounded-lg border border-dashed border-line-strong">
            Sem oportunidades
          </div>
        )}
      </div>
    </div>
  );
}
