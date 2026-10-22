"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ZoneChange } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

export default function ZoneDiverging({ rows }: { rows: ZoneChange[] }) {
  const reduceMotion = useReducedMotion();
  const limit = Math.max(...rows.map((row) => Math.abs(row.change ?? 0)), 10);

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, index) => {
        const change = row.change ?? 0;
        const width = `${(Math.abs(change) / limit) * 50}%`;
        const positive = change >= 0;
        return (
          <li key={row.zone} className="flex flex-col gap-1.5" title={`${formatMoney(row.current)} agora · ${formatMoney(row.previous)} antes`}>
            <span className="caption-style flex items-baseline justify-between gap-3">
              <span className="text-soft">{row.zone}</span>
              <span className="text-foreground tabular-nums">
                {row.change === null ? "novo" : `${positive ? "+" : "−"}${Math.abs(change)}%`}
                <span className="text-subtle"> · {formatMoneyCompact(row.current)}</span>
              </span>
            </span>
            <span className="relative h-3">
              <span aria-hidden className="bg-chart-axis absolute inset-y-[-2px] left-1/2 w-px" />
              <motion.span
                aria-hidden
                className="absolute inset-y-0 rounded-full"
                style={{
                  background: positive ? "var(--chart-1)" : "var(--chart-negative)",
                  left: positive ? "50%" : undefined,
                  right: positive ? undefined : "50%",
                }}
                initial={reduceMotion ? false : { width: 0 }}
                whileInView={{ width: row.change === null ? "50%" : width }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.06, ease: [0.25, 1, 0.5, 1] }}
              />
            </span>
          </li>
        );
      })}
      <li className="caption-style text-subtle flex justify-between" aria-hidden>
        <span>− {limit}%</span>
        <span>0</span>
        <span>+ {limit}%</span>
      </li>
    </ol>
  );
}
