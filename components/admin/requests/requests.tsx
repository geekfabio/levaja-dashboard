"use client";

import AdminHeader from "@/components/admin/shell/admin-header";
import { useRequestsList } from "@/hooks/admin/use-requests";
import { useZones } from "@/hooks/admin/use-zones";
import { activeRequestFilterCount, toRequestFilters, useAdminRequestsStore } from "@/stores/admin-requests-store";
import RequestsToolbar from "./toolbar/requests-toolbar";
import RequestsTable, { REQUEST_PAGE_SIZE } from "./table/requests-table";

export default function Requests() {
  const state = useAdminRequestsStore();
  const query = useRequestsList(toRequestFilters(state, REQUEST_PAGE_SIZE));
  const zones = useZones();

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Pedidos" count={query.data?.total} />
      <RequestsToolbar />
      <RequestsTable
        query={query}
        zones={zones.data ?? []}
        onPageChange={state.setPage}
        onReset={state.reset}
        filtered={activeRequestFilterCount(state) > 0}
      />
    </section>
  );
}
