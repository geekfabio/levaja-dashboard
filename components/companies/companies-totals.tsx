"use client";

import { useMemo } from "react";
import TotalsBar from "@/components/_common/totals/totals-bar";
import { useToday } from "@/hooks/use-today";
import { purchaseStats } from "@/lib/sales";
import { useSalesStore } from "@/stores/sales-store";
import { companyTotals } from "@/lib/companies";
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent, plural } from "@/lib/format";
import { useVisibleCompanies } from "./use-visible-companies";

export default function CompaniesTotals() {
  const companies = useVisibleCompanies();
  const totals = companyTotals(companies);
  const sales = useSalesStore((state) => state.sales);
  const today = useToday();
  const offRhythm = useMemo(
    () => companies.filter((company) => purchaseStats(sales, company.id, today).atRisk).length,
    [companies, sales, today],
  );

  return (
    <TotalsBar
      id="clientes"
      summary={`${plural(companies.length, "cliente", "clientes")} · ${formatMoneyCompact(totals.pipeline)} em carteira`}
      items={[
        { key: "clientes", label: "Clientes", value: formatNumber(companies.length), hint: "com os filtros atuais" },
        { key: "carteira", label: "Valor em carteira", value: formatMoneyCompact(totals.pipeline), fullValue: formatMoney(totals.pipeline) },
        { key: "ponderada", label: "Carteira ponderada", value: formatMoneyCompact(totals.weighted), fullValue: formatMoney(totals.weighted), hint: "pela probabilidade" },
        { key: "oportunidades", label: "Oportunidades abertas", value: formatNumber(totals.deals) },
        { key: "probabilidade", label: "Probabilidade média", value: formatPercent(totals.probability) },
        {
          key: "ritmo",
          label: "Fora do ritmo de compra",
          value: formatNumber(offRhythm),
          hint: "segundo o sistema de vendas",
          tone: offRhythm > 0 ? "danger" : undefined,
        },
        {
          key: "inativos",
          label: "Sem contacto há +30 dias",
          value: formatNumber(totals.inactive),
          tone: totals.inactive > 0 ? "warning" : undefined,
        },
      ]}
    />
  );
}
