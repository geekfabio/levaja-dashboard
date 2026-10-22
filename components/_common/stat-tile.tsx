"use client";

import { motion, useReducedMotion } from "motion/react";
import { SlidingNumber } from "@/components/motion-primitives/sliding-number";
import AnimatedSparkline from "./animated-sparkline";
import { ease } from "@/lib/easings";
import { cn } from "@/lib/utils";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

export type StatTileDelta = {
  percent: number;
  positiveIsGood: boolean;
  periodLabel: string;
};

type StatTileProps = {
  label: string;
  value: number;
  decimals?: number;
  decimalSeparator?: string;
  suffix?: string;
  delta?: StatTileDelta;
  trend?: number[];
  index?: number;
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export default function StatTile({
  label,
  value,
  decimals = 0,
  decimalSeparator = ",",
  suffix,
  delta,
  trend,
  index = 0,
}: StatTileProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayValue =
    decimals > 0
      ? Math.round(value * 10 ** decimals) / 10 ** decimals
      : Math.round(value);
  const up = delta ? delta.percent >= 0 : null;
  const deltaIsGood = delta ? up === delta.positiveIsGood : null;

  return (
    <motion.div
      variants={ITEM_VARIANTS}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.5,
        ease: ease.power3Out,
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -3 }}
      className="border-border bg-tile shadow-tile ease-power3-out flex flex-col gap-3 rounded-xl border p-5 transition-colors duration-150 hover:border-line-strong"
    >
      <span className="caption-style text-subtle">{label}</span>

      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="flex items-baseline text-[26px] leading-none font-semibold">
            <SlidingNumber value={displayValue} decimalSeparator={decimalSeparator} />
          </span>
          {suffix && (
            <span className="caption-style text-subtle font-normal">
              {suffix}
            </span>
          )}
        </div>
        {trend && trend.length > 1 && (
          <AnimatedSparkline
            values={trend}
            tone={deltaIsGood === false ? "danger" : "accent"}
            className="h-5 w-16 shrink-0"
            delay={prefersReducedMotion ? 0 : 0.15 * index}
          />
        )}
      </div>

      {delta && (
        <span
          className={cn(
            "caption-style flex items-center gap-1",
            deltaIsGood ? "text-success" : "text-danger",
          )}
        >
          <ChevronIcon
            aria-hidden
            className={cn("size-2.5", up ? "rotate-180" : "")}
          />
          {Math.abs(delta.percent)}% {delta.periodLabel}
        </span>
      )}
    </motion.div>
  );
}
