"use client";

import { useState } from "react";
import FilterMenu from "@/components/_common/filter-menu";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { ANY_CONDITION } from "@/data/automations";
import { useToday } from "@/hooks/use-today";
import { RUN_OUTCOMES, useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useAutomationsStore } from "@/stores/automations-store";
import RunItem from "./run-item";

const OUTCOME_OPTIONS = [
  { value: ANY_CONDITION, label: "Todos os resultados" },
  ...RUN_OUTCOMES.map((outcome) => ({ value: outcome, label: outcome })),
];

export default function RunsList() {
  const runs = useAutomationRunsStore((state) => state.runs);
  const runDue = useAutomationRunsStore((state) => state.runDue);
  const automations = useAutomationsStore((state) => state.automations);
  const today = useToday();
  const [outcome, setOutcome] = useState<string>(ANY_CONDITION);
  const [automationId, setAutomationId] = useState<string>(ANY_CONDITION);

  const automationOptions = [
    { value: ANY_CONDITION, label: "Todas as automações" },
    ...automations.map((automation) => ({ value: automation.id, label: automation.name })),
  ];
  const visible = runs.filter(
    (run) =>
      (outcome === ANY_CONDITION || run.outcome === outcome) &&
      (automationId === ANY_CONDITION || run.automationId === automationId),
  );

  return (
    <>
      <div className="flex shrink-0 flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <FilterMenu label="Automação" value={automationId} options={automationOptions} onChange={setAutomationId} />
            <FilterMenu label="Resultado" value={outcome} options={OUTCOME_OPTIONS} onChange={setOutcome} />
          </div>
          <Button variant="secondary" size="sm" onClick={() => runDue(today, { manual: true })}>
            Executar agora
          </Button>
        </div>
        <span className="caption-style text-subtle">
          O motor corre ao abrir o CRM e sempre que chega uma venda ou muda uma automação. E-mail e SMS ficam em modo sandbox: o texto fica registado aqui, nada sai do CRM.
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {visible.length > 0 ? (
          <ul className="divide-border flex flex-col divide-y px-5 pb-6">
            {visible.map((run) => (
              <RunItem key={run.id} run={run} showAutomation />
            ))}
          </ul>
        ) : (
          <p className="caption-style text-subtle px-5 py-10 text-center">
            {runs.length === 0 ? "Ainda nenhum passo executado nesta sessão." : "Sem execuções para estes filtros."}
          </p>
        )}
      </ScrollArea>
    </>
  );
}
