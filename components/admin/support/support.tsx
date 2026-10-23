"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { canAccessSection, hasPermission } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { Ticket } from "@/types/leva-ja";
import SosAlerts from "./sos/sos-alerts";
import TicketsPanel from "./tickets/tickets-panel";
import LowRatingsPanel from "./reviews/low-ratings-panel";
import SatisfactionPanel from "./satisfaction/satisfaction-panel";

export default function Support() {
  const user = useAdminSessionStore((state) => state.session?.user);
  const [tab, setTab] = useState("ocorrencias");
  if (!user) return null;
  const { role } = user;
  const tickets = hasPermission(role, "support.tickets");
  const reviews = hasPermission(role, "support.reviews");
  const current = tickets ? tab : "avaliacoes";
  const canOpenRequest = hasPermission(role, "requests.view");
  const canOpenRequester = (ticket: Ticket) => canAccessSection(role, ticket.requesterKind === "client" ? "clients" : "providers");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Suporte" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 p-5">
          {hasPermission(role, "support.sos") && <SosAlerts canOpenRequest={canOpenRequest} />}
          {(tickets || reviews) && (
            <Tabs value={current} onValueChange={setTab}>
              <TabsList aria-label="Secções do suporte" className="border-border border-b">
                {tickets && (
                  <TabsTrigger value="ocorrencias" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
                    Ocorrências
                  </TabsTrigger>
                )}
                {tickets && (
                  <TabsTrigger value="satisfacao" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
                    Satisfação
                  </TabsTrigger>
                )}
                {reviews && (
                  <TabsTrigger value="avaliacoes" className="focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-inset">
                    Avaliações baixas
                  </TabsTrigger>
                )}
              </TabsList>
              {tickets && (
                <TabsContent value="ocorrencias" className="pt-4">
                  <TicketsPanel userId={user.id} canOpenRequest={canOpenRequest} canOpenRequester={canOpenRequester} />
                </TabsContent>
              )}
              {tickets && (
                <TabsContent value="satisfacao" className="pt-4">
                  <SatisfactionPanel />
                </TabsContent>
              )}
              {reviews && (
                <TabsContent value="avaliacoes" className="pt-4">
                  <LowRatingsPanel canOpenRequest={canOpenRequest} canOpenProvider={hasPermission(role, "providers.view")} />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
