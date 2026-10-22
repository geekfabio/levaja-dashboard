"use client";

import { motion, useReducedMotion } from "motion/react";
import Tag from "@/components/_ui/tag";
import type { AtRiskClient } from "@/lib/dashboard";
import { formatMoney } from "@/lib/format";
import { ease } from "@/lib/easings";

type AtRiskListProps = {
  clients: AtRiskClient[];
};

const CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const ROW_VARIANTS = {
  hidden: { opacity: 0, x: 12 },
  show: { opacity: 1, x: 0 },
};

function riskLevel(days: number) {
  if (days >= 90) return { label: "Crítico", tone: "red" as const };
  if (days >= 60) return { label: "Atenção", tone: "amber" as const };
  return { label: "Vigiar", tone: "yellow" as const };
}

export default function AtRiskList({ clients }: AtRiskListProps) {
  const prefersReducedMotion = useReducedMotion();

  if (clients.length === 0) {
    return (
      <p className="caption-style text-subtle py-3">
        Sem clientes em risco para os filtros escolhidos.
      </p>
    );
  }

  return (
    <motion.ul
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="flex flex-col divide-y divide-border"
    >
      {clients.map((client) => {
        const risk = riskLevel(client.activityDays);
        return (
          <motion.li
            key={client.id}
            variants={ROW_VARIANTS}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: ease.power3Out }}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="lead-style truncate font-medium">
                {client.name}
              </span>
              <span className="caption-style text-subtle truncate">
                {client.owner} · {client.activityDays} dias sem atividade
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="caption-style text-subtle hidden tabular-nums sm:inline">
                {formatMoney(client.pipelineValue)}
              </span>
              <Tag tone={risk.tone} size="sm">
                {risk.label}
              </Tag>
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
