"use client";

import { motion, useReducedMotion } from "motion/react";
import type { FunnelStep } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

const SHADES = ["100%", "84%", "68%", "54%", "42%"];

export default function QuoteFunnel({ steps }: { steps: FunnelStep[] }) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...steps.map((step) => step.count), 1);

  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step, index) => {
        const previous = steps[index - 1];
        const rate = previous && previous.count > 0 ? Math.round((step.count / previous.count) * 100) : null;
        return (
          <li key={step.key} className="flex flex-col gap-1">
            {rate !== null && (
              <span className="caption-style text-subtle self-center tabular-nums">
                {rate <= 100 ? `↓ ${rate}%` : "inclui encomendas feitas sem cotação"}
              </span>
            )}
            <div className="flex items-center gap-3">
              <span className="caption-style text-soft w-[132px] shrink-0">{step.label}</span>
              <span className="flex flex-1 justify-center">
                <motion.span
                  className="flex h-8 items-center justify-center rounded-md"
                  style={{ background: `color-mix(in oklab, var(--chart-1) ${SHADES[index]}, var(--card))` }}
                  initial={reduceMotion ? false : { width: 0 }}
                  whileInView={{ width: `${Math.max(14, (step.count / max) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: reduceMotion ? 0 : index * 0.08, ease: [0.25, 1, 0.5, 1] }}
                  title={formatMoney(step.value)}
                >
                  <span className="caption-style text-foreground font-medium tabular-nums">{step.count}</span>
                </motion.span>
              </span>
              <span className="caption-style text-subtle w-[72px] shrink-0 text-right tabular-nums">{formatMoneyCompact(step.value)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
