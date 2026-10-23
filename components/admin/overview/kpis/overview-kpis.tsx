"use client";

import { motion } from "motion/react";
import StatTile from "@/components/_common/stat-tile";
import type { OverviewKpis as Kpis } from "@/data/leva-ja";
import { percentChange } from "@/lib/charts";
import { formatDecimal, formatKz, formatMinutes, formatNumber } from "@/lib/format";

type OverviewKpisProps = { kpis: Kpis; previous: Kpis; periodLabel: string };

const CONTAINER = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };

function delta(current: number, previous: number, periodLabel: string, positiveIsGood = true) {
  const percent = percentChange(current, previous);
  return percent === null ? undefined : { percent, positiveIsGood, periodLabel };
}

export default function OverviewKpis({ kpis, previous, periodLabel }: OverviewKpisProps) {
  const tiles = [
    { label: "Pedidos", value: kpis.requests, display: formatNumber(kpis.requests), delta: delta(kpis.requests, previous.requests, periodLabel) },
    { label: "Em curso", value: kpis.inProgress, display: formatNumber(kpis.inProgress) },
    { label: "Concluídos", value: kpis.completed, display: formatNumber(kpis.completed), delta: delta(kpis.completed, previous.completed, periodLabel) },
    { label: "Cancelados", value: kpis.cancelled, display: formatNumber(kpis.cancelled), delta: delta(kpis.cancelled, previous.cancelled, periodLabel, false) },
    {
      label: "Receita da plataforma",
      value: kpis.platformRevenue,
      display: formatKz(kpis.platformRevenue),
      delta: delta(kpis.platformRevenue, previous.platformRevenue, periodLabel),
    },
    { label: "Volume transaccionado", value: kpis.volume, display: formatKz(kpis.volume), delta: delta(kpis.volume, previous.volume, periodLabel) },
    {
      label: "Tempo médio até atribuição",
      value: kpis.avgAssignMinutes ?? 0,
      display: kpis.avgAssignMinutes === null ? "—" : formatMinutes(kpis.avgAssignMinutes),
      delta:
        kpis.avgAssignMinutes !== null && previous.avgAssignMinutes !== null
          ? delta(kpis.avgAssignMinutes, previous.avgAssignMinutes, periodLabel, false)
          : undefined,
    },
    { label: "Prestadores online", value: kpis.providersOnline, display: formatNumber(kpis.providersOnline) },
    {
      label: "Avaliação média",
      value: kpis.averageRating ?? 0,
      display: kpis.averageRating === null ? "—" : `${formatDecimal(kpis.averageRating, 2)} ★`,
    },
  ];

  return (
    <motion.div
      variants={CONTAINER}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
    >
      {tiles.map((tile, index) => (
        <StatTile key={tile.label} index={index} {...tile} />
      ))}
    </motion.div>
  );
}
