"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { PaymentMethod } from "@/data/sales";
import type { Share } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact, formatPercent, plural } from "@/lib/format";

export const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  "Multicaixa (TPA)": "var(--chart-1)",
  Numerário: "var(--chart-2)",
  Transferência: "var(--chart-3)",
  Crédito: "var(--chart-4)",
};

const SIZE = 200;
const RADIUS = 84;
const THICKNESS = 22;
const GAP_RADIANS = 0.03;

function arc(start: number, end: number) {
  const outer = RADIUS;
  const inner = RADIUS - THICKNESS;
  const point = (radius: number, angle: number) => [SIZE / 2 + radius * Math.sin(angle), SIZE / 2 - radius * Math.cos(angle)];
  const [x1, y1] = point(outer, start);
  const [x2, y2] = point(outer, end);
  const [x3, y3] = point(inner, end);
  const [x4, y4] = point(inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${x1},${y1} A${outer},${outer} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large} 0 ${x4},${y4} Z`;
}

export default function PaymentDonut({ mix }: { mix: Share<PaymentMethod>[] }) {
  const [hover, setHover] = useState<PaymentMethod | null>(null);
  const reduceMotion = useReducedMotion();
  const total = mix.reduce((sum, item) => sum + item.total, 0);
  const visible = mix.filter((item) => item.total > 0);
  const starts = visible.map((_, index) => visible.slice(0, index).reduce((sum, item) => sum + item.share * Math.PI * 2, 0));
  const focus = mix.find((item) => item.key === hover);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Vendas por forma de pagamento" className="shrink-0" onPointerLeave={() => setHover(null)}>
        {visible.map((item, index) => {
          const span = item.share * Math.PI * 2;
          const start = starts[index] + (visible.length > 1 ? GAP_RADIANS / 2 : 0);
          const end = starts[index] + span - (visible.length > 1 ? GAP_RADIANS / 2 : 0);
          return (
            <motion.path
              key={item.key}
              d={arc(start, Math.max(start + 0.001, end))}
              fill={PAYMENT_COLORS[item.key]}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: hover && hover !== item.key ? 0.35 : 1, scale: hover === item.key ? 1.04 : 1 }}
              style={{ transformOrigin: `${SIZE / 2}px ${SIZE / 2}px` }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.08, ease: [0.25, 1, 0.5, 1] }}
              onPointerEnter={() => setHover(item.key)}
              tabIndex={0}
              onFocus={() => setHover(item.key)}
              onBlur={() => setHover(null)}
              aria-label={`${item.key}: ${formatPercent(Math.round(item.share * 100))}`}
            />
          );
        })}
        <text x={SIZE / 2} y={SIZE / 2 - 8} textAnchor="middle" className="fill-subtle text-[11px]">
          {focus ? focus.key : "Total"}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 14} textAnchor="middle" className="fill-foreground text-[18px] font-semibold">
          {formatMoneyCompact(focus ? focus.total : total)}
        </text>
      </svg>
      <ul className="flex w-full flex-col gap-2">
        {mix.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3"
            onPointerEnter={() => setHover(item.key)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="caption-style text-soft flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: PAYMENT_COLORS[item.key] }} />
              {item.key}
            </span>
            <span className="caption-style text-foreground tabular-nums" title={`${formatMoney(item.total)} · ${plural(item.count, "compra", "compras")}`}>
              {formatPercent(Math.round(item.share * 100))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
