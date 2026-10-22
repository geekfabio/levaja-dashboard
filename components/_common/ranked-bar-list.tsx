"use client";

import { motion, useReducedMotion } from "motion/react";
import Avatar from "@/components/_ui/avatar";
import { ease } from "@/lib/easings";
import { formatMoney, formatPercent } from "@/lib/format";

export type RankedItem = {
  key: string;
  label: string;
  avatar?: string;
  amount: number;
  quota: number;
};

type RankedBarListProps = {
  items: RankedItem[];
};

const CONTAINER_VARIANTS = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const ROW_VARIANTS = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

export default function RankedBarList({ items }: RankedBarListProps) {
  const prefersReducedMotion = useReducedMotion();
  const max = Math.max(1, ...items.map((item) => item.amount));

  return (
    <motion.div
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="flex flex-col gap-4"
    >
      {items.map((item) => {
        const percent = (item.amount / max) * 100;
        const quotaPercent = Math.round((item.amount / item.quota) * 100);

        return (
          <motion.div
            key={item.key}
            variants={ROW_VARIANTS}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: ease.power3Out }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="lead-style flex min-w-0 items-center gap-2">
                {item.avatar && <Avatar src={item.avatar} alt="" />}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="caption-style text-subtle flex shrink-0 items-center gap-2 tabular-nums">
                {formatMoney(item.amount)}
                <span className="text-faint">·</span>
                {formatPercent(quotaPercent)} da quota
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/4">
              <motion.div
                className="bg-primary h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(percent, 2)}%` }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.6,
                  ease: ease.power3Out,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
