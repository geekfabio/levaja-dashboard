"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { useClock } from "@/hooks/admin/use-clock";
import { luandaDay } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import BatchesPanel from "./batches/batches-panel";
import RevenuePanel from "./revenue/revenue-panel";
import TransactionsPanel from "./transactions/transactions-panel";
import WithdrawalsPanel from "./withdrawals/withdrawals-panel";

const TABS = [
  { value: "receita", label: "Receita" },
  { value: "levantamentos", label: "Levantamentos" },
  { value: "lotes", label: "Lotes de pagamento" },
  { value: "transaccoes", label: "Transacções" },
];

export default function Finance() {
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const now = useClock();
  const today = luandaDay(new Date(now));
  const [tab, setTab] = useState("receita");
  if (!role) return null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Finanças" />
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1">
        <TabsList aria-label="Secções de finanças" className="border-border shrink-0 overflow-x-auto border-b px-4 *:whitespace-nowrap">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-5">
            <TabsContent value="receita">
              <RevenuePanel today={today} />
            </TabsContent>
            <TabsContent value="levantamentos">
              <WithdrawalsPanel canDecide={hasPermission(role, "finance.withdrawals")} />
            </TabsContent>
            <TabsContent value="lotes">
              <BatchesPanel canManage={hasPermission(role, "finance.withdrawals")} />
            </TabsContent>
            <TabsContent value="transaccoes">
              <TransactionsPanel today={today} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </section>
  );
}
