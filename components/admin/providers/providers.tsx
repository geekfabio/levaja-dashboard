"use client";

import AdminHeader from "@/components/admin/shell/admin-header";
import { useProvidersList } from "@/hooks/admin/use-providers";
import { useZones } from "@/hooks/admin/use-zones";
import { activeProviderFilterCount, toProviderFilters, useAdminProvidersStore } from "@/stores/admin-providers-store";
import ProvidersToolbar from "./toolbar/providers-toolbar";
import ProvidersTable, { PROVIDER_PAGE_SIZE } from "./table/providers-table";

export default function Providers() {
  const state = useAdminProvidersStore();
  const query = useProvidersList(toProviderFilters(state, PROVIDER_PAGE_SIZE));
  const zones = useZones();

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Prestadores" count={query.data?.total} />
      <ProvidersToolbar />
      <ProvidersTable
        query={query}
        zones={zones.data ?? []}
        filtered={activeProviderFilterCount(state) > 0}
        onPageChange={state.setPage}
        onReset={state.reset}
      />
    </section>
  );
}
