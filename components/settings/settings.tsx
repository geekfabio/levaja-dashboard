"use client";

import type { ComponentType } from "react";
import ModuleHeader from "@/components/_common/module-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import CompanyTab from "./company/company-tab";
import SendersTab from "./senders/senders-tab";
import TemplatesTab from "./templates/templates-tab";
import TeamsTab from "./teams/teams-tab";
import ZonesTab from "./zones/zones-tab";
import IntegrationsTab from "./integrations/integrations-tab";
import CatalogTab from "./catalog/catalog-tab";
import MessagingTab from "./messaging/messaging-tab";
import PrivacyTab from "./privacy/privacy-tab";
import AccessTab from "./access/access-tab";
import { useSettingsStore, type SettingsTab } from "@/stores/settings-store";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "empresa", label: "Empresa" },
  { key: "remetentes", label: "Remetentes" },
  { key: "modelos", label: "Modelos" },
  { key: "equipas", label: "Equipas" },
  { key: "zonas", label: "Zonas" },
  { key: "acessos", label: "Acessos" },
  { key: "integracoes", label: "Integrações" },
  { key: "catalogo", label: "Catálogo e preços" },
  { key: "mensagens", label: "Mensagens e saldo" },
  { key: "dados", label: "Proteção de dados" },
];

const PANELS: Record<SettingsTab, ComponentType> = {
  empresa: CompanyTab,
  remetentes: SendersTab,
  modelos: TemplatesTab,
  equipas: TeamsTab,
  zonas: ZonesTab,
  acessos: AccessTab,
  integracoes: IntegrationsTab,
  catalogo: CatalogTab,
  mensagens: MessagingTab,
  dados: PrivacyTab,
};

export default function Settings() {
  const tab = useSettingsStore((state) => state.tab);
  const setTab = useSettingsStore((state) => state.setTab);
  const Panel = PANELS[tab];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Definições" />
      <Tabs value={tab} onValueChange={(value) => setTab(value as SettingsTab)}>
        <TabsList className="border-border overflow-x-auto border-b px-4 *:whitespace-nowrap">
          {TABS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-[1280px]">
          <Panel />
        </div>
      </ScrollArea>
    </section>
  );
}
