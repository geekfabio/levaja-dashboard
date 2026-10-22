"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import type { AbcClass } from "@/data/campaigns";
import { useElementWidth } from "@/hooks/use-element-width";
import { axisTicks, median, niceMax, type ClientPoint } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact, plural } from "@/lib/format";
import ChartTooltip, { TooltipRow } from "./chart-tooltip";

export const ABC_COLORS: Record<AbcClass, string> = {
  A: "var(--chart-1)",
  B: "var(--chart-2)",
  C: "var(--chart-3)",
};

const HEIGHT = 320;
const RECENCY_TICKS = [0, 3, 7, 15, 30, 60, 90, 120, 180, 365];
const PAD = { top: 16, right: 16, bottom: 36, left: 56 };

export default function ClientMatrix({ points }: { points: ClientPoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<ClientPoint | null>(null);
  const reduceMotion = useReducedMotion();
  const openTarget = useOpenTarget();
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const maxX = niceMax(Math.max(...points.map((point) => point.recency), 10));
  const maxY = niceMax(Math.max(...points.map((point) => point.volume), 1));
  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const x = (value: number) => PAD.left + Math.sqrt(value / maxX) * plotWidth;
  const y = (value: number) => PAD.top + plotHeight - (value / maxY) * plotHeight;
  const r = (count: number) => 5 + Math.sqrt(count / maxCount) * 9;
  const medianX = median(points.map((point) => point.recency));
  const medianY = median(points.map((point) => point.volume));
  const labelled = useMemo(
    () =>
      new Set(
        points
          .filter((point) => point.recency > medianX && point.volume >= medianY)
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 3)
          .map((point) => point.company.id),
      ),
    [points, medianX, medianY],
  );

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best: ClientPoint | null = null;
    let bestDistance = 28;
    for (const point of points) {
      const distance = Math.hypot(x(point.recency) - px, y(point.volume) - py) - r(point.count);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
    setHover(best);
  }

  const quadrants = [
    { label: "Fiéis e grandes", x: PAD.left + 8, y: PAD.top + 14, anchor: "start" as const },
    { label: "Grandes a esfriar", x: width - PAD.right - 8, y: PAD.top + 14, anchor: "end" as const },
    { label: "Pequenos ativos", x: PAD.left + 8, y: PAD.top + plotHeight - 8, anchor: "start" as const },
    { label: "Adormecidos", x: width - PAD.right - 8, y: PAD.top + plotHeight - 8, anchor: "end" as const },
  ];

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Clientes por dias desde a última compra e volume de 90 dias"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => hover && openTarget({ module: "Clientes", id: hover.company.id, label: hover.company.name })}
        className="block cursor-crosshair touch-none"
      >
        {axisTicks(maxY).map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
              {tick === 0 ? "0" : formatMoneyCompact(tick)}
            </text>
          </g>
        ))}
        {RECENCY_TICKS.filter((tick) => tick <= maxX).map((tick) => (
          <text key={`x-${tick}`} x={x(tick)} y={HEIGHT - 18} textAnchor="middle" className="fill-subtle text-[11px] tabular-nums">
            {tick}
          </text>
        ))}
        <text x={PAD.left + plotWidth / 2} y={HEIGHT - 2} textAnchor="middle" className="fill-subtle text-[11px]">
          Dias desde a última compra
        </text>
        <line x1={x(medianX)} x2={x(medianX)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--chart-axis)" />
        <line x1={PAD.left} x2={width - PAD.right} y1={y(medianY)} y2={y(medianY)} stroke="var(--chart-axis)" />
        {points.map((point, index) => (
          <motion.circle
            key={point.company.id}
            cx={x(point.recency)}
            cy={y(point.volume)}
            fill={ABC_COLORS[point.abc]}
            stroke="var(--card)"
            strokeWidth={2}
            initial={reduceMotion ? false : { r: 0, opacity: 0 }}
            animate={{ r: r(point.count), opacity: hover && hover.company.id !== point.company.id ? 0.35 : 0.9 }}
            transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.03, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        {points
          .filter((point) => width >= 480 && labelled.has(point.company.id))
          .map((point) => (
            <text
              key={point.company.id}
              x={x(point.recency) + (x(point.recency) < PAD.left + plotWidth / 2 ? r(point.count) + 6 : -r(point.count) - 6)}
              y={y(point.volume)}
              dy="0.32em"
              textAnchor={x(point.recency) < PAD.left + plotWidth / 2 ? "start" : "end"}
              stroke="var(--card)"
              strokeWidth={3}
              paintOrder="stroke"
              className="fill-soft pointer-events-none text-[11px]"
            >
              {point.company.name}
            </text>
          ))}
        {quadrants.map((quadrant) => (
          <text key={quadrant.label} x={quadrant.x} y={quadrant.y} textAnchor={quadrant.anchor} stroke="var(--card)" strokeWidth={3} paintOrder="stroke" className="fill-faint pointer-events-none text-[11px] font-medium">
            {quadrant.label}
          </text>
        ))}
      </svg>
      {hover && (
        <ChartTooltip x={x(hover.recency)} y={y(hover.volume)} width={width}>
          <span className="caption-style text-foreground font-medium">{hover.company.name}</span>
          <TooltipRow color={ABC_COLORS[hover.abc]} label="Classe" value={hover.abc} />
          <TooltipRow label="Volume 90 dias" value={formatMoney(hover.volume)} />
          <TooltipRow label="Última compra" value={hover.recency === 0 ? "hoje" : `há ${hover.recency} dias`} />
          <span className="caption-style text-subtle">{plural(hover.count, "compra", "compras")} em 90 dias · clique para abrir</span>
        </ChartTooltip>
      )}
    </div>
  );
}
