"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { useClock } from "@/hooks/admin/use-clock";
import { usePlatformSettings } from "@/hooks/admin/use-settings";
import { luandaDay } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import CashPanel from "./cash/cash-panel";
import InvoicesPanel from "./invoices/invoices-panel";
import ReconciliationPanel from "./reconciliation/reconciliation-panel";

const TABS = [
  { value: "documentos", label: "Facturas e notas de crédito" },
  { value: "reconciliacao", label: "Reconciliação" },
  { value: "numerario", label: "Numerário" },
];

export default function Billing() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const now = useClock();
  const settings = usePlatformSettings();
  const today = luandaDay(new Date(now));
  const [tab, setTab] = useState("documentos");
  if (!role) return null;
  const canManage = hasPermission(role, "billing.manage");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Facturação" />
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1">
        <TabsList aria-label="Secções de facturação" className="border-border shrink-0 overflow-x-auto border-b px-4 *:whitespace-nowrap">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-5">
            <TabsContent value="documentos">
              <InvoicesPanel today={today} />
            </TabsContent>
            <TabsContent value="reconciliacao">
              <ReconciliationPanel today={today} canManage={canManage} />
            </TabsContent>
            <TabsContent value="numerario">
              <CashPanel canManage={canManage} settlementDays={settings.data?.payouts.cashSettlementDays} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </section>
  );
}
