"use client";

import { useEffect, useState } from "react";
import Button from "@/components/_ui/button";
import FilterMenu from "@/components/_common/filter-menu";
import { Input } from "@/components/_ui/input";
import { useZones } from "@/hooks/admin/use-zones";
import { PAYMENT_LABELS, PAYMENT_METHODS, SERVICE_KINDS, SERVICE_LABELS } from "@/lib/leva-ja/services";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/leva-ja/status";
import {
  ACTIVE_FILTER,
  ANY,
  DISPUTED_FILTER,
  activeRequestFilterCount,
  useAdminRequestsStore,
  type RequestsFilterState,
} from "@/stores/admin-requests-store";
import SearchIcon from "@/public/assets/images/_common/search.svg";

const STATUS_OPTIONS = [
  { value: ANY, label: "Todos" },
  { value: ACTIVE_FILTER, label: "Em curso" },
  { value: DISPUTED_FILTER, label: "Em disputa" },
  ...ALL_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

const KIND_OPTIONS = [{ value: ANY, label: "Todos" }, ...SERVICE_KINDS.map((kind) => ({ value: kind, label: SERVICE_LABELS[kind] }))];

const PAYMENT_OPTIONS = [{ value: ANY, label: "Todos" }, ...PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_LABELS[method] }))];

export default function RequestsToolbar() {
  const state = useAdminRequestsStore();
  const zones = useZones();
  const [query, setQuery] = useState(state.q);
  const setFilter = state.setFilter;
  const count = activeRequestFilterCount(state);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== useAdminRequestsStore.getState().q) setFilter("q", query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, setFilter]);

  const zoneOptions = [{ value: ANY, label: "Todas" }, ...(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))];

  return (
    <div className="flex shrink-0 flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[360px]">
          <span className="sr-only">Pesquisar por código, cliente ou prestador</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input
            type="search"
            value={query}
            placeholder="Código, cliente ou prestador"
            onChange={(event) => setQuery(event.target.value)}
            className="h-[30px] pl-8 text-[13px]"
          />
        </label>
        <FilterMenu label="Estado" value={state.status} options={STATUS_OPTIONS} onChange={(value) => setFilter("status", value as RequestsFilterState["status"])} />
        <FilterMenu label="Serviço" value={state.kind} options={KIND_OPTIONS} onChange={(value) => setFilter("kind", value as RequestsFilterState["kind"])} />
        <FilterMenu label="Zona" value={state.zone} options={zoneOptions} onChange={(value) => setFilter("zone", value)} />
        <FilterMenu label="Pagamento" value={state.payment} options={PAYMENT_OPTIONS} onChange={(value) => setFilter("payment", value as RequestsFilterState["payment"])} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="caption-style text-subtle flex items-center gap-2">
          De
          <Input
            type="date"
            value={state.from}
            max={state.to || undefined}
            onChange={(event) => setFilter("from", event.target.value)}
            className="h-[30px] w-[150px] text-[13px]"
          />
        </label>
        <label className="caption-style text-subtle flex items-center gap-2">
          Até
          <Input
            type="date"
            value={state.to}
            min={state.from || undefined}
            onChange={(event) => setFilter("to", event.target.value)}
            className="h-[30px] w-[150px] text-[13px]"
          />
        </label>
        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              state.reset();
            }}
          >
            Limpar filtros ({count})
          </Button>
        )}
      </div>
    </div>
  );
}
