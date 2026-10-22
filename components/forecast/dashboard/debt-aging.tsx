"use client";

import { motion, useReducedMotion } from "motion/react";
import type { DebtBucket } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact, plural } from "@/lib/format";

export const DEBT_SHADES = ["28%", "52%", "76%", "100%"].map(
  (amount) => `color-mix(in oklab, var(--chart-negative) ${amount}, var(--card))`,
);

export default function DebtAging({ buckets }: { buckets: DebtBucket[] }) {
  const reduceMotion = useReducedMotion();
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  if (total === 0) return <p className="caption-style text-subtle">Sem vendas a crédito por pagar.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[26px] leading-none font-semibold whitespace-nowrap">{formatMoneyCompact(total)}</span>
        <span className="caption-style text-subtle">por receber de clientes a crédito</span>
      </div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Dívida por antiguidade">
        {buckets
          .filter((bucket) => bucket.total > 0)
          .map((bucket, index) => (
            <motion.span
              key={bucket.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ background: DEBT_SHADES[buckets.indexOf(bucket)] }}
              initial={reduceMotion ? false : { flexGrow: 0 }}
              whileInView={{ flexGrow: bucket.total }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.08, ease: [0.25, 1, 0.5, 1] }}
              title={`${bucket.label}: ${formatMoney(bucket.total)}`}
            />
          ))}
      </div>
      <ul className="flex flex-col gap-2">
        {buckets.map((bucket, index) => (
          <li key={bucket.key} className="flex items-center justify-between gap-3">
            <span className="caption-style text-soft flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: DEBT_SHADES[index] }} />
              {bucket.label}
            </span>
            <span className="caption-style text-foreground tabular-nums">
              {formatMoney(bucket.total)} <span className="text-subtle">· {plural(bucket.count, "fatura", "faturas")}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
