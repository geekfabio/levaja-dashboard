"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useElementWidth } from "@/hooks/use-element-width";
import { HEATMAP_DAYS, HEATMAP_HOURS, type HeatCell } from "@/lib/analytics";
import { formatMoney, plural } from "@/lib/format";
import ChartTooltip, { TooltipRow } from "./chart-tooltip";

const LABEL_WIDTH = 36;
const HEADER = 20;
const GAP = 2;

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function heatColor(ratio: number) {
  if (ratio <= 0) return "var(--chart-grid)";
  return `color-mix(in oklab, var(--chart-1) ${Math.round(18 + ratio * 82)}%, var(--card))`;
}

export default function HeatmapChart({ cells }: { cells: HeatCell[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<HeatCell | null>(null);
  const reduceMotion = useReducedMotion();
  const max = Math.max(...cells.map((cell) => cell.count), 1);
  const cellWidth = (width - LABEL_WIDTH) / HEATMAP_HOURS.length;
  const cellHeight = Math.min(30, Math.max(20, cellWidth * 0.62));
  const height = HEADER + HEATMAP_DAYS.length * cellHeight + 4;

  return (
    <div ref={ref} className="relative flex w-full flex-col gap-3">
      <svg width={width} height={height} role="img" aria-label="Compras por dia da semana e hora" onPointerLeave={() => setHover(null)} className="block">
        {HEATMAP_HOURS.map((hour, column) =>
          column % (cellWidth < 34 ? 2 : 1) === 0 ? (
            <text key={hour} x={LABEL_WIDTH + column * cellWidth + cellWidth / 2} y={12} textAnchor="middle" className="fill-subtle text-[11px] tabular-nums">
              {hour}h
            </text>
          ) : null,
        )}
        {HEATMAP_DAYS.map((day, row) => (
          <text key={day} x={0} y={HEADER + row * cellHeight + cellHeight / 2} dy="0.32em" className="fill-subtle text-[11px]">
            {day}
          </text>
        ))}
        {cells.map((cell, index) => {
          const column = HEATMAP_HOURS.indexOf(cell.hour as (typeof HEATMAP_HOURS)[number]);
          const active = hover?.day === cell.day && hover?.hour === cell.hour;
          return (
            <motion.rect
              key={`${cell.day}-${cell.hour}`}
              x={LABEL_WIDTH + column * cellWidth + GAP / 2}
              y={HEADER + cell.day * cellHeight + GAP / 2}
              width={cellWidth - GAP}
              height={cellHeight - GAP}
              rx={4}
              fill={heatColor(cell.count / max)}
              stroke={active ? "var(--foreground)" : "none"}
              strokeWidth={active ? 1.5 : 0}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : (column + cell.day) * 0.025 }}
              onPointerEnter={() => setHover(cell)}
              tabIndex={0}
              onFocus={() => setHover(cell)}
              aria-label={`${DAY_NAMES[cell.day]} às ${cell.hour}h: ${plural(cell.count, "compra", "compras")}`}
              data-index={index}
            />
          );
        })}
      </svg>
      <div className="flex items-center gap-2" aria-hidden>
        <span className="caption-style text-subtle">Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <span key={ratio} className="h-2.5 w-6 rounded-[3px]" style={{ background: heatColor(ratio) }} />
        ))}
        <span className="caption-style text-subtle">Mais compras</span>
      </div>
      {hover && (
        <ChartTooltip
          x={LABEL_WIDTH + HEATMAP_HOURS.indexOf(hover.hour as (typeof HEATMAP_HOURS)[number]) * cellWidth + cellWidth}
          y={HEADER + hover.day * cellHeight}
          width={width}
        >
          <span className="caption-style text-foreground font-medium">
            {DAY_NAMES[hover.day]}, {hover.hour}h–{hover.hour + 1}h
          </span>
          <TooltipRow label="Compras" value={String(hover.count)} />
          <TooltipRow label="Valor" value={formatMoney(hover.total)} />
        </ChartTooltip>
      )}
    </div>
  );
}
