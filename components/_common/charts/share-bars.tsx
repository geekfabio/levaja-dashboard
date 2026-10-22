"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatNumber, formatPercent } from "@/lib/format";

export type ShareBarItem = { key: string; label: string; value: number; color?: string; detail?: string };

type ShareBarsProps = {
  items: ShareBarItem[];
  format?: (value: number) => string;
};

export default function ShareBars({ items, format = formatNumber }: ShareBarsProps) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.key} className="flex flex-col gap-1.5" title={item.detail}>
          <span className="caption-style flex items-baseline justify-between gap-3">
            <span className="text-soft truncate">{item.label}</span>
            <span className="text-foreground shrink-0 tabular-nums">
              {format(item.value)} <span className="text-subtle">· {formatPercent(total > 0 ? Math.round((item.value / total) * 100) : 0)}</span>
            </span>
          </span>
          <span className="bg-chart-grid h-2 overflow-hidden rounded-full">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: item.color ?? "var(--chart-1)" }}
              initial={reduceMotion ? false : { width: 0 }}
              whileInView={{ width: `${(item.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.06, ease: [0.25, 1, 0.5, 1] }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
