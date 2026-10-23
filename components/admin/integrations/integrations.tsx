"use client";

import AdminHeader from "@/components/admin/shell/admin-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import ApiKeysPanel from "./keys/api-keys-panel";
import WebhooksPanel from "./webhooks/webhooks-panel";

export default function Integrations() {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Integrações" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-8 p-5">
          <ApiKeysPanel />
          <WebhooksPanel />
        </div>
      </ScrollArea>
    </section>
  );
}
