"use client";

import { motion, useReducedMotion } from "motion/react";
import { SlidingNumber } from "@/components/motion-primitives/sliding-number";
import AnimatedSparkline from "@/components/_common/animated-sparkline";
import SegmentBar from "@/components/_common/segment-bar";
import { ease } from "@/lib/easings";
import { formatPercent } from "@/lib/format";

type HeroFigureProps = {
  label: string;
  amount: number;
  suffix: string;
  quotaPercent: number;
  quotaLabel: string;
  trend: number[];
};

export default function HeroFigure({
  label,
  amount,
  suffix,
  quotaPercent,
  quotaLabel,
  trend,
}: HeroFigureProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: ease.power3Out }}
      className="border-border bg-tile shadow-tile relative flex flex-col gap-4 overflow-hidden rounded-xl border p-6"
    >
      <motion.div
        aria-hidden
        className="bg-primary pointer-events-none absolute -top-24 -right-24 size-64 rounded-full blur-[90px]"
        initial={{ opacity: 0.12 }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.12 }
            : { opacity: [0.1, 0.22, 0.1] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 5, repeat: Infinity, ease: ease.power1InOut }
        }
      />

      <div className="relative flex flex-col gap-1">
        <span className="caption-style text-subtle">{label}</span>
        <div className="flex flex-wrap items-end gap-3">
          <span className="flex items-baseline text-[44px] leading-none font-semibold tracking-[-0.01em]">
            <SlidingNumber value={amount} decimalSeparator="," />
          </span>
          <span className="lead-style text-subtle pb-1">{suffix}</span>
        </div>
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="caption-style text-subtle flex items-center justify-between">
            <span>{quotaLabel}</span>
            <span>{formatPercent(quotaPercent)}</span>
          </div>
          <SegmentBar
            percent={quotaPercent}
            segments={63}
            className="h-3 w-full border border-white/4 px-px"
            segmentClassName="h-2"
            trackClassName="bg-white/8"
          />
        </div>
        <AnimatedSparkline
          values={trend}
          tone="accent"
          className="hidden h-10 w-32 shrink-0 sm:block"
          delay={prefersReducedMotion ? 0 : 0.3}
        />
      </div>
    </motion.div>
  );
}
