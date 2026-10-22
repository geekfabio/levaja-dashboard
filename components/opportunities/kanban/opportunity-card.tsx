"use client";

import type { DragEvent } from "react";
import Tag from "@/components/_ui/tag";
import SegmentBar from "@/components/_common/segment-bar";
import type { Opportunity } from "@/data/opportunities";
import { formatDateShort, formatMoney } from "@/lib/format";

type OpportunityCardProps = {
  opportunity: Opportunity;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

export default function OpportunityCard({
  opportunity,
  onOpen,
  onDragStart,
  onDragEnd,
}: OpportunityCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="ease-power3-out flex cursor-grab flex-col gap-2 rounded-lg border border-line-strong bg-card p-3 text-left shadow-[0px_1px_0px_0px_rgba(255,255,255,0.04)] transition-colors duration-150 hover:bg-[var(--card-raised)] active:cursor-grabbing"
    >
      <span className="lead-style truncate font-medium">
        {opportunity.companyName}
      </span>
      <span className="caption-style text-subtle truncate">
        {opportunity.contactName}
      </span>
      <span className="flex items-center justify-between gap-2 tabular-nums">
        <span className="lead-style">{formatMoney(opportunity.value)}</span>
        <Tag size="sm" tone="neutral">
          {formatDateShort(opportunity.expectedCloseDate)}
        </Tag>
      </span>
      <span className="flex items-center gap-2">
        <SegmentBar percent={opportunity.probability} className="w-full" />
        <span className="caption-style w-[4ch] shrink-0 text-right">
          {opportunity.probability}%
        </span>
      </span>
    </div>
  );
}
