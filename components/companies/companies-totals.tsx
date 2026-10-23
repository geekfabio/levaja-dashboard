"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import { companyTotals } from "@/lib/companies";
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent, plural } from "@/lib/format";
import { useVisibleCompanies } from "./use-visible-companies";

export default function CompaniesTotals() {
  const companies = useVisibleCompanies();
  const totals = companyTotals(companies);

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
          key: "inativos",
          label: "Sem contacto há +30 dias",
          value: formatNumber(totals.inactive),
          tone: totals.inactive > 0 ? "warning" : undefined,
        },
      ]}
    />
  );
}
