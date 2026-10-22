"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import type { Opportunity } from "@/data/opportunities";
import { formatMoney, formatMoneyCompact, formatNumber, nowLuandaLocal, plural } from "@/lib/format";
import { isOverdue } from "@/lib/opportunities";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

const CLOSED = ["Fechada - Ganha", "Fechada - Perdida"];

export default function OpportunitiesTotals({ opportunities }: { opportunities: Opportunity[] }) {
  const overdue = useOpportunitiesStore((state) => state.overdue);
  const setOverdue = useOpportunitiesStore((state) => state.setOverdue);
  const today = nowLuandaLocal().slice(0, 10);

  const open = opportunities.filter((item) => !CLOSED.includes(item.stage));
  const won = opportunities.filter((item) => item.stage === "Fechada - Ganha");
  const lost = opportunities.filter((item) => item.stage === "Fechada - Perdida");
  const openValue = open.reduce((sum, item) => sum + item.value, 0);
  const weighted = open.reduce((sum, item) => sum + (item.value * item.probability) / 100, 0);
  const wonValue = won.reduce((sum, item) => sum + item.value, 0);
  const late = opportunities.filter((item) => isOverdue(item, today)).length;
  const closed = won.length + lost.length;

  return (
    <TotalsBar
      id="oportunidades"
      summary={`${plural(open.length, "aberta", "abertas")} · ${formatMoneyCompact(openValue)}`}
      items={[
        { key: "abertas", label: "Abertas", value: formatNumber(open.length) },
        { key: "valor", label: "Valor em aberto", value: formatMoneyCompact(openValue), fullValue: formatMoney(openValue) },
        { key: "ponderado", label: "Valor ponderado", value: formatMoneyCompact(weighted), fullValue: formatMoney(weighted), hint: "pela probabilidade" },
        { key: "ganho", label: "Ganho", value: formatMoneyCompact(wonValue), fullValue: formatMoney(wonValue), hint: plural(won.length, "fechada com sucesso", "fechadas com sucesso"), tone: won.length ? "success" : undefined },
        {
          key: "conversao",
          label: "Taxa de conversão",
          value: closed ? `${Math.round((won.length / closed) * 100)}%` : "—",
          hint: "ganhas sobre fechadas",
        },
        {
          key: "atrasadas",
          label: "Atrasadas",
          value: formatNumber(late),
          hint: overdue ? "a filtrar — clique para ver todas" : "clique para filtrar",
          tone: late > 0 ? "danger" : undefined,
          pressed: overdue,
          onSelect: () => setOverdue(!overdue),
        },
      ]}
    />
  );
}
