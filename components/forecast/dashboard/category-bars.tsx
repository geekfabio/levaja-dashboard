"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ProductCategory } from "@/data/sales";
import type { Share } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact, formatPercent } from "@/lib/format";

export default function CategoryBars({ items }: { items: Share<ProductCategory>[] }) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...items.map((item) => item.total), 1);

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.key} className="flex flex-col gap-1.5" title={formatMoney(item.total)}>
          <span className="caption-style flex items-baseline justify-between gap-3">
            <span className="text-soft truncate">{item.key}</span>
            <span className="text-foreground shrink-0 tabular-nums">
              {formatMoneyCompact(item.total)} <span className="text-subtle">· {formatPercent(Math.round(item.share * 100))}</span>
            </span>
          </span>
          <span className="bg-chart-grid h-2 overflow-hidden rounded-full">
            <motion.span
              className="bg-chart-1 block h-full rounded-full"
              initial={reduceMotion ? false : { width: 0 }}
              whileInView={{ width: `${(item.total / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.06, ease: [0.25, 1, 0.5, 1] }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
