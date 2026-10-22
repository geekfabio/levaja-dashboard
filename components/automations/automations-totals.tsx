"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import { ANY_CONDITION, type Automation, type AutomationStatus } from "@/data/automations";
import { formatNumber, plural } from "@/lib/format";
import { useAutomationsStore } from "@/stores/automations-store";

export default function AutomationsTotals({ automations }: { automations: Automation[] }) {
  const status = useAutomationsStore((state) => state.status);
  const setStatusFilter = useAutomationsStore((state) => state.setStatusFilter);
  const count = (value: AutomationStatus) => automations.filter((item) => item.status === value).length;
  const enrolled = automations.reduce((sum, item) => sum + item.enrolled, 0);
  const completed = automations.reduce((sum, item) => sum + item.completed, 0);

  function tile(key: string, label: string, value: AutomationStatus, tone?: "success" | "warning") {
    return {
      key,
      label,
      value: formatNumber(count(value)),
      tone: count(value) > 0 ? tone : undefined,
      pressed: status === value,
      onSelect: () => setStatusFilter(status === value ? ANY_CONDITION : value),
    };
  }

  return (
    <TotalsBar
      id="automacoes"
      summary={`${plural(count("Ativa"), "ativa", "ativas")} · ${plural(enrolled, "inscrito", "inscritos")}`}
      items={[
        { key: "total", label: "Automações", value: formatNumber(automations.length) },
        tile("ativas", "Ativas", "Ativa", "success"),
        tile("pausadas", "Pausadas", "Pausada", "warning"),
        tile("rascunhos", "Rascunhos", "Rascunho"),
        { key: "inscritos", label: "Inscritos", value: formatNumber(enrolled), hint: "contactos em sequência" },
        {
          key: "concluidos",
          label: "Concluídos",
          value: formatNumber(completed),
          hint: enrolled ? `${Math.round((completed / enrolled) * 100)}% dos inscritos` : undefined,
        },
      ]}
    />
  );
}
