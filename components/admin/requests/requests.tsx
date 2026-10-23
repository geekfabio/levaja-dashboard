"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { useRequestsList } from "@/hooks/admin/use-requests";
import { useZones } from "@/hooks/admin/use-zones";
import { activeRequestFilterCount, toRequestFilters, useAdminRequestsStore } from "@/stores/admin-requests-store";
import SlaPanel from "./sla/sla-panel";
import RequestsToolbar from "./toolbar/requests-toolbar";
import RequestsTable, { REQUEST_PAGE_SIZE } from "./table/requests-table";

export default function Requests() {
  const state = useAdminRequestsStore();
  const query = useRequestsList(toRequestFilters(state, REQUEST_PAGE_SIZE));
  const zones = useZones();
  const [tab, setTab] = useState("lista");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Pedidos" count={query.data?.total} />
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Vistas dos pedidos" className="border-border shrink-0 overflow-x-auto border-b px-4 *:whitespace-nowrap">
          <TabsTrigger value="lista" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
            Lista
          </TabsTrigger>
          <TabsTrigger value="prazos" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
            Prazos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <RequestsToolbar />
          <RequestsTable
            query={query}
            zones={zones.data ?? []}
            onPageChange={state.setPage}
            onReset={state.reset}
            filtered={activeRequestFilterCount(state) > 0}
          />
        </TabsContent>
        <TabsContent value="prazos" className="min-h-0 flex-1 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="p-5">
              <SlaPanel />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </section>
  );
}
