"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Button from "@/components/_ui/button";
import RankedBarList from "@/components/_common/ranked-bar-list";
import type { Opportunity } from "@/data/opportunities";
import { byManager } from "@/lib/dashboard";
import { byTeam, byZoneLive, performanceCsvRows, type ReportDimension } from "@/lib/reports";
import { downloadCsv } from "@/lib/csv";
import { TODAY } from "@/lib/companies";
import { ease } from "@/lib/easings";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSettingsStore } from "@/stores/settings-store";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

type PerformancePanelProps = {
  opportunities: Opportunity[];
};

const DIMENSIONS: { key: ReportDimension; label: string; csvLabel: string }[] = [
  { key: "gestor", label: "Gestor", csvLabel: "Gestor" },
  { key: "zona", label: "Zona", csvLabel: "Zona" },
  { key: "equipa", label: "Equipa", csvLabel: "Equipa" },
];

export default function PerformancePanel({ opportunities }: PerformancePanelProps) {
  const [dimension, setDimension] = useState<ReportDimension>("gestor");
  const companies = useCompaniesStore((state) => state.companies);
  const zones = useSettingsStore((state) => state.zones);
  const teams = useSettingsStore((state) => state.teams);
  const memberships = useSettingsStore((state) => state.memberships);

  const items = useMemo(() => {
    if (dimension === "zona") return byZoneLive(opportunities, companies, zones);
    if (dimension === "equipa") return byTeam(opportunities, teams, memberships);
    return byManager(opportunities).map((manager) => ({
      key: manager.name,
      label: manager.name,
      avatar: manager.avatar,
      amount: manager.amount,
      quota: manager.quota,
    }));
  }, [dimension, opportunities, companies, zones, teams, memberships]);

  const active = DIMENSIONS.find((item) => item.key === dimension)!;

  function exportCsv() {
    downloadCsv(
      `desempenho-${dimension}-${TODAY}.csv`,
      performanceCsvRows(active.csvLabel, items),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {DIMENSIONS.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={item.key === dimension ? "primary" : "ghost"}
              size="sm"
              onClick={() => setDimension(item.key)}
              className="rounded-full"
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <ShareIcon aria-hidden className="size-3" />
          Exportar
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={dimension}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: ease.power2Out }}
        >
          <RankedBarList items={items} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
