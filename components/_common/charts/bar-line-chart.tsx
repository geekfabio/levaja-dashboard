"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useElementWidth } from "@/hooks/use-element-width";
import { axisTicks, niceMax } from "@/lib/charts";
import { formatNumber } from "@/lib/format";
import ChartTooltip, { TooltipRow } from "./chart-tooltip";

export type BarLinePoint = { key: string; label: string; title?: string; bar: number; line?: number };

type BarLineChartProps = {
  points: BarLinePoint[];
  ariaLabel: string;
  barLabel: string;
  lineLabel?: string;
  format?: (value: number) => string;
  formatAxis?: (value: number) => string;
  detail?: (point: BarLinePoint) => ReactNode;
  height?: number;
};

const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

export default function BarLineChart({
  points,
  ariaLabel,
  barLabel,
  lineLabel,
  format = formatNumber,
  formatAxis = formatNumber,
  detail,
  height = 240,
}: BarLineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...points.map((point) => Math.max(point.bar, point.line ?? 0)), 1));
  const step = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(2, Math.min(18, step - 2));
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
  const x = (index: number) => PAD.left + index * step + step / 2;
  const ticks = axisTicks(max);
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 70)));
  const hasLine = points.some((point) => point.line !== undefined);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.line ?? 0).toFixed(1)}`).join(" ");

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - rect.left - PAD.left) / step);
    setHover(index >= 0 && index < points.length ? index : null);
  }

  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-none"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
              {tick === 0 ? "0" : formatAxis(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const barHeight = Math.max(0, y(0) - y(point.bar));
          return (
            <motion.rect
              key={point.key}
              x={x(index) - barWidth / 2}
              width={barWidth}
              rx={Math.min(4, barWidth / 2)}
              initial={reduceMotion ? false : { y: y(0), height: 0 }}
              animate={{ y: y(point.bar), height: barHeight }}
              transition={{ duration: 0.6, delay: reduceMotion ? 0 : index * 0.008, ease: [0.25, 1, 0.5, 1] }}
              fill="var(--chart-1)"
              opacity={hover === null || hover === index ? 0.85 : 0.35}
            />
          );
        })}
        {hasLine && (
          <motion.path
            d={line}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
          />
        )}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--chart-axis)" strokeWidth={1} />
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text key={point.key} x={x(index)} y={height - 8} textAnchor="middle" className="fill-subtle text-[11px] tabular-nums">
              {point.label}
            </text>
          ) : null,
        )}
        {active && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="var(--chart-axis)" strokeWidth={1} />
            {active.line !== undefined && (
              <circle cx={x(hover)} cy={y(active.line)} r={4.5} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} />
            )}
          </g>
        )}
      </svg>
      {active && hover !== null && (
        <ChartTooltip x={x(hover)} y={y(Math.max(active.bar, active.line ?? 0))} width={width}>
          <span className="caption-style text-foreground font-medium">{active.title ?? active.label}</span>
          <TooltipRow color="var(--chart-1)" label={barLabel} value={format(active.bar)} />
          {active.line !== undefined && lineLabel && <TooltipRow color="var(--chart-2)" label={lineLabel} value={format(active.line)} />}
          {detail?.(active)}
        </ChartTooltip>
      )}
    </div>
  );
}
