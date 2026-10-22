"use client";

import { useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SALE_CHANNELS, type SaleChannel } from "@/data/sales";
import { useElementWidth } from "@/hooks/use-element-width";
import { axisTicks, niceMax, type ChannelWeek } from "@/lib/analytics";
import { addDays } from "@/lib/follow-up";
import { formatDateShort, formatMoney, formatMoneyCompact } from "@/lib/format";
import ChartTooltip, { TooltipRow } from "./chart-tooltip";

export const CHANNEL_COLORS: Record<SaleChannel, string> = {
  "Loja Viana": "var(--chart-1)",
  "Loja Cazenga": "var(--chart-2)",
  Televendas: "var(--chart-3)",
  Entrega: "var(--chart-4)",
};

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };
const GAP = 2;

function topRounded(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

export default function ChannelStackChart({ weeks }: { weeks: ChannelWeek[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...weeks.map((week) => week.total), 1));
  const step = plotWidth / Math.max(weeks.length, 1);
  const barWidth = Math.max(6, Math.min(36, step * 0.62));
  const scale = (value: number) => (value / max) * plotHeight;
  const base = PAD.top + plotHeight;
  const ticks = axisTicks(max);
  const labelEvery = Math.ceil(weeks.length / Math.max(2, Math.floor(plotWidth / 64)));

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - rect.left - PAD.left) / step);
    setHover(index >= 0 && index < weeks.length ? index : null);
  }

  const active = hover !== null ? weeks[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={HEIGHT} role="img" aria-label="Vendas por semana e canal" onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={base - scale(tick)} y2={base - scale(tick)} stroke="var(--chart-grid)" />
            <text x={PAD.left - 8} y={base - scale(tick)} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
              {tick === 0 ? "0" : formatMoneyCompact(tick)}
            </text>
          </g>
        ))}
        {weeks.map((week, index) => {
          const x = PAD.left + index * step + (step - barWidth) / 2;
          let top = base;
          const segments = SALE_CHANNELS.filter((channel) => week.values[channel] > 0);
          return (
            <motion.g
              key={week.week}
              initial={reduceMotion ? false : { opacity: 0, scaleY: 0 }}
              animate={{ opacity: hover === null || hover === index ? 1 : 0.4, scaleY: 1 }}
              style={{ transformOrigin: `0px ${base}px` }}
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : index * 0.03, ease: [0.25, 1, 0.5, 1] }}
            >
              {segments.map((channel, segmentIndex) => {
                const height = scale(week.values[channel]);
                const drawn = Math.max(1, height - (segmentIndex < segments.length - 1 ? GAP : 0));
                top -= height;
                const y = top + (height - drawn);
                return segmentIndex === segments.length - 1 ? (
                  <path key={channel} d={topRounded(x, top, barWidth, drawn, 4)} fill={CHANNEL_COLORS[channel]} />
                ) : (
                  <rect key={channel} x={x} y={y} width={barWidth} height={drawn} fill={CHANNEL_COLORS[channel]} />
                );
              })}
            </motion.g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} stroke="var(--chart-axis)" />
        {weeks.map((week, index) =>
          index % labelEvery === 0 ? (
            <text key={week.week} x={PAD.left + index * step + step / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-subtle text-[11px] tabular-nums">
              {formatDateShort(week.week)}
            </text>
          ) : null,
        )}
      </svg>
      {active && hover !== null && (
        <ChartTooltip x={PAD.left + hover * step + step / 2} y={base - scale(active.total)} width={width}>
          <span className="caption-style text-foreground font-medium">
            Semana de {formatDateShort(active.week)} a {formatDateShort(addDays(active.week, 6))}
          </span>
          {SALE_CHANNELS.map((channel) => (
            <TooltipRow key={channel} color={CHANNEL_COLORS[channel]} label={channel} value={formatMoney(active.values[channel])} />
          ))}
          <TooltipRow label="Total" value={formatMoney(active.total)} />
        </ChartTooltip>
      )}
    </div>
  );
}
