"use client";

import { usePathname, useRouter } from "next/navigation";
import { AUDIT_MODULE_ROUTES, type EntityRef } from "@/data/audit";
import { useAutomationsStore } from "@/stores/automations-store";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useTicketsStore } from "@/stores/tickets-store";

function openEntity({ module, id }: EntityRef) {
  if (!id) return;
  switch (module) {
    case "Clientes": {
      const store = useCompaniesStore.getState();
      if (store.companies.some((item) => item.id === id)) store.openDetail(id);
      return;
    }
    case "Contactos": {
      const store = useContactsStore.getState();
      if (store.contacts.some((item) => item.id === id)) store.openDetail(id);
      return;
    }
    case "Oportunidades": {
      const store = useOpportunitiesStore.getState();
      if (store.opportunities.some((item) => item.id === id)) store.openDetail(id);
      return;
    }
    case "Tickets": {
      const store = useTicketsStore.getState();
      if (store.tickets.some((item) => item.id === id)) store.openDetail(id);
      return;
    }
    case "Campanhas": {
      const store = useCampaignsStore.getState();
      if (store.campaigns.some((item) => item.id === id)) store.openEditor(id);
      return;
    }
    case "Automações": {
      const store = useAutomationsStore.getState();
      if (store.automations.some((item) => item.id === id)) store.openEditor(id);
      return;
    }
  }
}

export function useOpenTarget() {
  const router = useRouter();
  const pathname = usePathname();

  return (target: EntityRef) => {
    openEntity(target);
    const route = AUDIT_MODULE_ROUTES[target.module];
    if (route !== pathname) router.push(route);
  };
}
