"use client";

import ModuleHeader from "@/components/_common/module-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { useActivitiesStore, type ActivitiesView } from "@/stores/activities-store";

type ActivitiesHeaderProps = {
  count: number;
};

export default function ActivitiesHeader({ count }: ActivitiesHeaderProps) {
  const view = useActivitiesStore((state) => state.view);
  const setView = useActivitiesStore((state) => state.setView);

  return (
    <ModuleHeader title="Atividades" count={count}>
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as ActivitiesView)}
      >
        <TabsList className="border-border overflow-x-auto border-b px-4 *:whitespace-nowrap">
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="rota">Rota do Dia</TabsTrigger>
        </TabsList>
      </Tabs>
    </ModuleHeader>
  );
}
