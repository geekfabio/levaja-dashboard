"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { useProvidersList } from "@/hooks/admin/use-providers";
import { useZones } from "@/hooks/admin/use-zones";
import { activeProviderFilterCount, toProviderFilters, useAdminProvidersStore } from "@/stores/admin-providers-store";
import QualityTable from "./quality/quality-table";
import ProvidersToolbar from "./toolbar/providers-toolbar";
import ProvidersTable, { PROVIDER_PAGE_SIZE } from "./table/providers-table";

export default function Providers() {
  const state = useAdminProvidersStore();
  const query = useProvidersList(toProviderFilters(state, PROVIDER_PAGE_SIZE));
  const zones = useZones();
  const [tab, setTab] = useState("lista");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Prestadores" count={query.data?.total} />
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Vistas dos prestadores" className="border-border shrink-0 overflow-x-auto border-b px-4 *:whitespace-nowrap">
          <TabsTrigger value="lista" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
            Lista
          </TabsTrigger>
          <TabsTrigger value="qualidade" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
            Qualidade e penalizações
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <ProvidersToolbar />
          <ProvidersTable
            query={query}
            zones={zones.data ?? []}
            filtered={activeProviderFilterCount(state) > 0}
            onPageChange={state.setPage}
            onReset={state.reset}
          />
        </TabsContent>
        <TabsContent value="qualidade" className="min-h-0 flex-1 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="p-5">
              <QualityTable />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </section>
  );
}
