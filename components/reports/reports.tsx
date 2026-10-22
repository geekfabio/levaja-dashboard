"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import ModuleHeader from "@/components/_common/module-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import StatTile from "@/components/_common/stat-tile";
import PerformancePanel from "./performance-panel";
import AtRiskPanel from "./at-risk-panel";
import CommissionsPanel from "./commissions-panel";
import {
  activeVsInactive,
  conversionRate,
  openOpportunities,
  wonOpportunities,
} from "@/lib/dashboard";
import { stageTotal } from "@/lib/opportunities";
import { compactMoneyParts } from "@/lib/format";
import { useCompaniesStore } from "@/stores/companies-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

const KPI_CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export default function Reports() {
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const companies = useCompaniesStore((state) => state.companies);

  const metrics = useMemo(() => {
    const open = openOpportunities(opportunities);
    const won = stageTotal(wonOpportunities(opportunities));
    const { active } = activeVsInactive(companies);

    return {
      pipelineTotal: stageTotal(open),
      salesTotal: won,
      conversion: conversionRate(opportunities),
      activeClients: active,
      totalClients: companies.length,
    };
  }, [opportunities, companies]);

  const salesParts = compactMoneyParts(metrics.salesTotal);
  const pipelineParts = compactMoneyParts(metrics.pipelineTotal);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Relatórios" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-8 p-5">
          <motion.div
            variants={KPI_CONTAINER_VARIANTS}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <StatTile
              label="Vendas do período"
              value={salesParts.amount}
              decimals={1}
              suffix={salesParts.suffix}
              index={0}
            />
            <StatTile
              label="Carteira aberta"
              value={pipelineParts.amount}
              decimals={1}
              suffix={pipelineParts.suffix}
              index={1}
            />
            <StatTile
              label="Taxa de conversão"
              value={metrics.conversion}
              suffix="%"
              index={2}
            />
            <StatTile
              label="Clientes ativos"
              value={metrics.activeClients}
              suffix={`/ ${metrics.totalClients}`}
              index={3}
            />
          </motion.div>

          <div className="border-border flex flex-col gap-4 rounded-xl border p-5">
            <h2 className="eyebrow-style text-faint font-normal">
              Desempenho por gestor, zona e equipa
            </h2>
            <PerformancePanel opportunities={opportunities} />
          </div>

          <div className="border-border flex flex-col gap-4 rounded-xl border p-5">
            <h2 className="eyebrow-style text-faint font-normal">
              Objetivos e comissões
            </h2>
            <CommissionsPanel />
          </div>

          <div className="border-border flex flex-col gap-4 rounded-xl border p-5">
            <h2 className="eyebrow-style text-faint font-normal">
              Clientes em risco
            </h2>
            <AtRiskPanel companies={companies} />
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}
