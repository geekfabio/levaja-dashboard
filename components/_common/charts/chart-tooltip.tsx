import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChartTooltipProps = {
  x: number;
  y: number;
  width: number;
  children: ReactNode;
  className?: string;
};

export default function ChartTooltip({ x, y, width, children, className }: ChartTooltipProps) {
  const flip = x > width - 200;
  return (
    <div
      role="status"
      className={cn(
        "bg-popover pointer-events-none absolute z-10 flex min-w-[150px] flex-col gap-1 rounded-lg px-3 py-2 shadow-overlay",
        className,
      )}
      style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 12) }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <span className="caption-style flex items-center justify-between gap-4">
      <span className="text-soft flex items-center gap-1.5">
        {color && <span aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} />}
        {label}
      </span>
      <span className="text-foreground tabular-nums">{value}</span>
    </span>
  );
}
