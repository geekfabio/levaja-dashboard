"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ease } from "@/lib/easings";

type AnimatedSparklineProps = {
  values: number[];
  tone?: "accent" | "success" | "danger";
  className?: string;
  delay?: number;
};

const WIDTH = 100;
const HEIGHT = 28;
const PAD = 2;

const TONE_STROKE: Record<NonNullable<AnimatedSparklineProps["tone"]>, string> = {
  accent: "var(--primary)",
  success: "var(--success)",
  danger: "var(--danger)",
};

function buildPath(values: number[]) {
  if (values.length === 0) return { line: "", area: "" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (WIDTH - PAD * 2) / Math.max(1, values.length - 1);

  const points = values.map((value, index) => {
    const x = PAD + index * stepX;
    const y = PAD + (1 - (value - min) / range) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  const area = `${line} L${lastX.toFixed(2)},${HEIGHT - PAD} L${firstX.toFixed(2)},${HEIGHT - PAD} Z`;

  return { line, area };
}

export default function AnimatedSparkline({
  values,
  tone = "accent",
  className,
  delay = 0,
}: AnimatedSparklineProps) {
  const gradientId = useId();
  const prefersReducedMotion = useReducedMotion();
  const { line, area } = useMemo(() => buildPath(values), [values]);
  const stroke = TONE_STROKE[tone];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.5,
          delay: prefersReducedMotion ? 0 : delay + 0.5,
          ease: ease.power2Out,
        }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.7,
          delay: prefersReducedMotion ? 0 : delay,
          ease: ease.power3Out,
        }}
      />
    </svg>
  );
}
