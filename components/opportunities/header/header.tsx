"use client";

import ModuleHeader from "@/components/_common/module-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

type OpportunitiesHeaderProps = {
  count: number;
};

export default function OpportunitiesHeader({
  count,
}: OpportunitiesHeaderProps) {
  const view = useOpportunitiesStore((state) => state.view);
  const setView = useOpportunitiesStore((state) => state.setView);

  return (
    <ModuleHeader title="Oportunidades" count={count}>
      <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
        <TabsList className="border-border border-b px-4">
          <TabsTrigger value="kanban">Quadro</TabsTrigger>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
        </TabsList>
      </Tabs>
    </ModuleHeader>
  );
}
