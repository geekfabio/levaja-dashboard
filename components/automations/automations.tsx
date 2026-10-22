"use client";

import { useMemo } from "react";
import ModuleHeader from "@/components/_common/module-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import AutomationsToolbar from "./toolbar/toolbar";
import AutomationsTotals from "./automations-totals";
import AutomationsTable from "./table/automations-table";
import AutomationBuilder from "./builder/automation-builder";
import OffersList from "./offers/offers-list";
import RunsList from "./runs/runs-list";
import { useToday } from "@/hooks/use-today";
import { isOfferOpen } from "@/lib/automation-engine";
import { filterAutomations } from "@/lib/automations";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useAutomationsStore, type AutomationsView } from "@/stores/automations-store";

export default function Automations() {
  const automations = useAutomationsStore((state) => state.automations);
  const status = useAutomationsStore((state) => state.status);
  const search = useAutomationsStore((state) => state.search);
  const editorId = useAutomationsStore((state) => state.editorId);
  const view = useAutomationsStore((state) => state.view);
  const setView = useAutomationsStore((state) => state.setView);
  const offers = useAutomationRunsStore((state) => state.offers);
  const runs = useAutomationRunsStore((state) => state.runs);
  const today = useToday();

  const visible = useMemo(
    () => filterAutomations(automations, { status, search }),
    [automations, status, search],
  );
  const openOffers = offers.filter((offer) => isOfferOpen(offer, today)).length;

  const editing = automations.find((automation) => automation.id === editorId);
  if (editing) return <AutomationBuilder automation={editing} />;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader
        title="Automações"
        count={view === "automacoes" ? visible.length : view === "propostas" ? offers.length : runs.length}
      >
        <Tabs value={view} onValueChange={(value) => setView(value as AutomationsView)}>
          <TabsList className="border-border overflow-x-auto border-b px-4 *:whitespace-nowrap">
            <TabsTrigger value="automacoes">Automações</TabsTrigger>
            <TabsTrigger value="propostas">Propostas de desconto · {openOffers}</TabsTrigger>
            <TabsTrigger value="execucoes">Execuções · {runs.length}</TabsTrigger>
          </TabsList>
        </Tabs>
      </ModuleHeader>
      {view === "automacoes" && (
        <>
          <AutomationsTotals automations={visible} />
          <AutomationsToolbar />
          <AutomationsTable automations={visible} />
        </>
      )}
      {view === "propostas" && <OffersList />}
      {view === "execucoes" && <RunsList />}
    </section>
  );
}
