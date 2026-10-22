"use client";

import { useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useElementWidth } from "@/hooks/use-element-width";
import { axisTicks, niceMax } from "@/lib/charts";
import { formatNumber } from "@/lib/format";
import ChartTooltip, { TooltipRow } from "./chart-tooltip";

export type StackSeries = { key: string; label: string; color: string };

export type StackPoint = { key: string; label: string; title?: string; values: Record<string, number> };

type StackedBarChartProps = {
  points: StackPoint[];
  series: StackSeries[];
  ariaLabel: string;
  format?: (value: number) => string;
  formatAxis?: (value: number) => string;
  totalLabel?: string;
  height?: number;
};

const PAD = { top: 12, right: 8, bottom: 26, left: 56 };
const GAP = 2;

function topRounded(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

export default function StackedBarChart({
  points,
  series,
  ariaLabel,
  format = formatNumber,
  formatAxis = formatNumber,
  totalLabel = "Total",
  height = 240,
}: StackedBarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const totals = points.map((point) => series.reduce((sum, item) => sum + (point.values[item.key] ?? 0), 0));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...totals, 1));
  const step = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(4, Math.min(36, step * 0.62));
  const scale = (value: number) => (value / max) * plotHeight;
  const base = PAD.top + plotHeight;
  const ticks = axisTicks(max);
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 64)));

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - rect.left - PAD.left) / step);
    setHover(index >= 0 && index < points.length ? index : null);
  }

  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={base - scale(tick)} y2={base - scale(tick)} stroke="var(--chart-grid)" />
            <text x={PAD.left - 8} y={base - scale(tick)} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
              {tick === 0 ? "0" : formatAxis(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = PAD.left + index * step + (step - barWidth) / 2;
          let top = base;
          const segments = series.filter((item) => (point.values[item.key] ?? 0) > 0);
          return (
            <motion.g
              key={point.key}
              initial={reduceMotion ? false : { opacity: 0, scaleY: 0 }}
              animate={{ opacity: hover === null || hover === index ? 1 : 0.4, scaleY: 1 }}
              style={{ transformOrigin: `0px ${base}px` }}
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : index * 0.02, ease: [0.25, 1, 0.5, 1] }}
            >
              {segments.map((item, segmentIndex) => {
                const segmentHeight = scale(point.values[item.key] ?? 0);
                const drawn = Math.max(1, segmentHeight - (segmentIndex < segments.length - 1 ? GAP : 0));
                top -= segmentHeight;
                const y = top + (segmentHeight - drawn);
                return segmentIndex === segments.length - 1 ? (
                  <path key={item.key} d={topRounded(x, top, barWidth, drawn, 4)} fill={item.color} />
                ) : (
                  <rect key={item.key} x={x} y={y} width={barWidth} height={drawn} fill={item.color} />
                );
              })}
            </motion.g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} stroke="var(--chart-axis)" />
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text key={point.key} x={PAD.left + index * step + step / 2} y={height - 8} textAnchor="middle" className="fill-subtle text-[11px] tabular-nums">
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
      {active && hover !== null && (
        <ChartTooltip x={PAD.left + hover * step + step / 2} y={base - scale(totals[hover])} width={width}>
          <span className="caption-style text-foreground font-medium">{active.title ?? active.label}</span>
          {series.map((item) => (
            <TooltipRow key={item.key} color={item.color} label={item.label} value={format(active.values[item.key] ?? 0)} />
          ))}
          <TooltipRow label={totalLabel} value={format(totals[hover])} />
        </ChartTooltip>
      )}
    </div>
  );
}
