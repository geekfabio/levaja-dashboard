"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatNumber } from "@/lib/format";

export type FunnelBarStep = { key: string; label: string; count: number; value?: number };

type FunnelBarsProps = {
  steps: FunnelBarStep[];
  formatValue?: (value: number) => string;
};

export default function FunnelBars({ steps, formatValue }: FunnelBarsProps) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...steps.map((step) => step.count), 1);

  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step, index) => {
        const previous = steps[index - 1];
        const rate = previous && previous.count > 0 ? Math.round((step.count / previous.count) * 100) : null;
        const shade = Math.max(14, 42 - index * (28 / Math.max(steps.length - 1, 1)));
        return (
          <li key={step.key} className="flex flex-col gap-1">
            {rate !== null && <span className="caption-style text-subtle self-center tabular-nums">↓ {rate}%</span>}
            <div className="flex items-center gap-3">
              <span className="caption-style text-soft w-[132px] shrink-0">{step.label}</span>
              <span className="flex flex-1 justify-center">
                <motion.span
                  className="flex h-8 items-center justify-center rounded-md"
                  style={{ background: `color-mix(in oklab, var(--chart-1) ${shade}%, var(--card))` }}
                  initial={reduceMotion ? false : { width: 0 }}
                  whileInView={{ width: `${Math.max(14, (step.count / max) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: reduceMotion ? 0 : index * 0.06, ease: [0.25, 1, 0.5, 1] }}
                >
                  <span className="caption-style text-foreground font-medium tabular-nums">{formatNumber(step.count)}</span>
                </motion.span>
              </span>
              {formatValue && (
                <span className="caption-style text-subtle w-[72px] shrink-0 text-right tabular-nums">{formatValue(step.value ?? 0)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
