"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import Avatar from "@/components/_ui/avatar";
import { profileByName } from "@/data/companies";
import type { SellerResult } from "@/lib/commissions";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

const VISIBLE = 8;

export default function TargetBullets({
  results,
}: {
  results: SellerResult[];
}) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? results : results.slice(0, VISIBLE);
  const max = Math.max(
    ...results.map((item) => Math.max(item.target, item.sold, item.projection)),
    1,
  );

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {shown.map((item, index) => {
          const profile = profileByName(item.owner);
          const pct = (value: number) =>
            `${Math.min(100, (value / max) * 100)}%`;
          return (
            <li key={item.owner} className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-3">
                <span className="caption-style text-soft flex min-w-0 items-center gap-2">
                  <Avatar src={profile.avatar} alt="" className="size-5" />
                  <span className="truncate">{item.owner}</span>
                </span>
                <span className="caption-style shrink-0 tabular-nums">
                  <span className="text-foreground">
                    {formatMoneyCompact(item.sold)}
                  </span>
                  <span className="text-subtle">
                    {" "}
                    de {formatMoneyCompact(item.target)} ·{" "}
                  </span>
                  <span
                    className={cn(
                      item.achievement >= 100
                        ? "text-(--tag-green-text)"
                        : "text-foreground",
                    )}
                  >
                    {item.achievement}%
                  </span>
                </span>
              </span>
              <span
                className="bg-chart-grid relative h-3 rounded-full"
                title={`Vendido ${formatMoney(item.sold)} · objetivo ${formatMoney(item.target)} · projeção ${formatMoney(item.projection)}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: pct(item.projection),
                    background:
                      "color-mix(in oklab, var(--chart-1) 28%, transparent)",
                  }}
                />
                <motion.span
                  aria-hidden
                  className="bg-chart-1 absolute inset-y-0 left-0 rounded-full"
                  initial={reduceMotion ? false : { width: 0 }}
                  whileInView={{ width: pct(item.sold) }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.7,
                    delay: reduceMotion ? 0 : index * 0.05,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                />
                <span
                  aria-hidden
                  className="bg-foreground absolute -inset-y-1 w-[2px] rounded-full"
                  style={{ left: pct(item.target) }}
                />
              </span>
            </li>
          );
        })}
      </ol>
      {results.length > VISIBLE && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? "Mostrar menos"
            : `Mostrar todos os ${results.length} gestores`}
        </Button>
      )}
    </div>
  );
}
