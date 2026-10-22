"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import AsyncState from "@/components/_common/async-state";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { errorMessage } from "@/data/leva-ja";
import { usePricing } from "@/hooks/admin/use-pricing";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import PricingEditor from "./editor/pricing-editor";
import ZonesPanel from "./zones/zones-panel";

export default function Pricing() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const pricing = usePricing();
  const [tab, setTab] = useState("precos");
  if (!role) return null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Preços e zonas" />
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1">
        <TabsList aria-label="Secções de preços e zonas" className="border-border shrink-0 border-b px-4">
          <TabsTrigger value="precos" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
            Tabela de preços
          </TabsTrigger>
          <TabsTrigger value="zonas" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
            Zonas
          </TabsTrigger>
        </TabsList>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-5">
            <TabsContent value="precos">
              <AsyncState
                query={pricing}
                skeleton={
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <Skeleton className="h-[480px] rounded-xl" />
                    <Skeleton className="h-[360px] rounded-xl" />
                  </div>
                }
                errorDescription={errorMessage}
              >
                {(config) => <PricingEditor key={config.updatedAt} config={config} canEdit={hasPermission(role, "pricing.edit")} />}
              </AsyncState>
            </TabsContent>
            <TabsContent value="zonas">
              <ZonesPanel canEdit={hasPermission(role, "zones.edit")} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </section>
  );
}
