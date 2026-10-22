"use client";

import Button from "@/components/_ui/button";
import type { Automation } from "@/data/automations";
import { formatMoneyCompact, formatNumber } from "@/lib/format";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useAutomationsStore } from "@/stores/automations-store";
import RunItem from "../runs/run-item";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="caption-style text-subtle">{label}</span>
      <span className="lead-style font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function AutomationResults({ automation }: { automation: Automation }) {
  const runs = useAutomationRunsStore((state) => state.runs);
  const offers = useAutomationRunsStore((state) => state.offers);
  const setView = useAutomationsStore((state) => state.setView);
  const own = runs.filter((run) => run.automationId === automation.id);
  const ownOffers = offers.filter((offer) => offer.automationId === automation.id);
  const used = ownOffers.filter((offer) => offer.status === "Aproveitada");
  const proposes = automation.steps.some((step) => step.action === "propor-desconto");

  return (
    <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
      <h2 className="eyebrow-style text-faint font-normal">Execuções</h2>
      {proposes && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Propostas" value={formatNumber(ownOffers.length)} />
          <Stat label="Aproveitadas" value={formatNumber(used.length)} />
          <Stat
            label="Vendas com desconto"
            value={formatMoneyCompact(used.reduce((sum, offer) => sum + (offer.saleTotal ?? 0), 0))}
          />
        </div>
      )}
      {own.length > 0 ? (
        <ul className="divide-border flex flex-col divide-y">
          {own.slice(0, 5).map((run) => (
            <RunItem key={run.id} run={run} />
          ))}
        </ul>
      ) : (
        <span className="caption-style text-subtle">
          {automation.status === "Ativa"
            ? "Nenhum passo executado nesta sessão — nenhum cliente chegou ainda a um passo."
            : "Ative a automação para começar a executar os passos."}
        </span>
      )}
      {own.length > 5 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setView("execucoes")}>
          Ver as {formatNumber(own.length)} execuções
        </Button>
      )}
    </section>
  );
}
