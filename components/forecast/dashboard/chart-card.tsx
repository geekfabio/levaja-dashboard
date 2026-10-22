"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { ease } from "@/lib/easings";
import { cn } from "@/lib/utils";

export type LegendItem = { label: string; color: string; value?: string };

export type ChartTable = { columns: string[]; rows: (string | number)[][] };

type ChartCardProps = {
  title: string;
  description?: string;
  legend?: LegendItem[];
  table: ChartTable;
  insight?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="caption-style text-soft flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
          {item.value && <span className="text-foreground tabular-nums">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function ChartCard({ title, description, legend, table, insight, className, children }: ChartCardProps) {
  const [view, setView] = useState<"grafico" | "tabela">("grafico");
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: ease.power3Out }}
      className={cn("border-border bg-card/40 flex min-w-0 flex-col gap-4 rounded-xl border p-5", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="eyebrow-style text-faint font-normal">{title}</h2>
          {description && <p className="caption-style text-subtle max-w-[40em]">{description}</p>}
        </div>
        <div className="bg-muted/60 flex shrink-0 rounded-full p-0.5" role="group" aria-label={`Vista de ${title}`}>
          {(["grafico", "tabela"] as const).map((option) => (
            <Button
              key={option}
              variant="ghost"
              size="sm"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className="aria-pressed:bg-secondary aria-pressed:text-foreground px-2.5 py-1.5"
            >
              {option === "grafico" ? "Gráfico" : "Tabela"}
            </Button>
          ))}
        </div>
      </div>

      {view === "grafico" ? (
        <>
          {legend && legend.length > 1 && <Legend items={legend} />}
          {children}
          {insight && <p className="caption-style text-soft">{insight}</p>}
        </>
      ) : (
        <ScrollArea orientation="both" className="max-h-[360px]">
          <table className="w-full min-w-[420px] border-collapse text-[13px]">
            <thead>
              <tr className="border-border border-b">
                {table.columns.map((column, index) => (
                  <th key={column} className={cn("caption-style text-subtle py-2 pr-3 font-normal", index > 0 ? "text-right" : "text-left")}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-border border-b last:border-0">
                  {row.map((cell, index) => (
                    <td key={index} className={cn("py-2 pr-3", index > 0 ? "text-right tabular-nums" : "text-left")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </motion.section>
  );
}
