"use client";

import { motion, useReducedMotion } from "motion/react";
import type { StageBreakdown } from "@/lib/dashboard";
import { formatMoney } from "@/lib/format";
import { ease } from "@/lib/easings";

const TONE_FILL: Record<string, string> = {
  blue: "var(--tag-blue-text)",
  amber: "var(--tag-amber-text)",
  purple: "var(--tag-purple-text)",
  green: "var(--tag-green-text)",
  red: "var(--tag-red-text)",
};

const STAGE_TONES: Record<string, string> = {
  Qualificação: "blue",
  Proposta: "amber",
  Negociação: "purple",
  "Fechada - Ganha": "green",
  "Fechada - Perdida": "red",
};

type FunnelChartProps = {
  stages: StageBreakdown[];
};

export default function FunnelChart({ stages }: FunnelChartProps) {
  const prefersReducedMotion = useReducedMotion();
  const max = Math.max(1, ...stages.map((stage) => stage.value));

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, index) => {
        const percent = (stage.value / max) * 100;
        const tone = STAGE_TONES[stage.stage] ?? "blue";

        return (
          <div key={stage.stage} className="flex flex-col gap-1.5">
            <div className="caption-style flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="text-foreground font-medium">
                  {stage.stage}
                </span>
                <span className="text-subtle">{stage.count}</span>
              </span>
              <span className="text-subtle tabular-nums">
                {formatMoney(stage.value)}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-[6px] bg-white/4">
              <motion.div
                className="h-full rounded-[6px]"
                style={{ backgroundColor: TONE_FILL[tone] }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(percent, stage.value > 0 ? 3 : 0)}%` }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.7,
                  delay: prefersReducedMotion ? 0 : index * 0.08,
                  ease: ease.power3Out,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
