"use client";

import { useEffect, useState } from "react";
import Button from "@/components/_ui/button";
import FilterMenu from "@/components/_common/filter-menu";
import { Input } from "@/components/_ui/input";
import { useZones } from "@/hooks/admin/use-zones";
import { SERVICE_KINDS, SERVICE_LABELS } from "@/lib/leva-ja/services";
import { ANY, activeProviderFilterCount, useAdminProvidersStore, type ProvidersFilterState } from "@/stores/admin-providers-store";
import SearchIcon from "@/public/assets/images/_common/search.svg";

const STATUS_OPTIONS = [
  { value: ANY, label: "Todos" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "suspended", label: "Suspensos" },
  { value: "pending", label: "Por aprovar" },
];

const VERIFIED_OPTIONS = [
  { value: ANY, label: "Todos" },
  { value: "yes", label: "Verificados" },
  { value: "no", label: "Por verificar" },
];

const SERVICE_OPTIONS = [{ value: ANY, label: "Todos" }, ...SERVICE_KINDS.map((kind) => ({ value: kind, label: SERVICE_LABELS[kind] }))];

export default function ProvidersToolbar() {
  const state = useAdminProvidersStore();
  const zones = useZones();
  const [query, setQuery] = useState(state.q);
  const setFilter = state.setFilter;
  const count = activeProviderFilterCount(state);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== useAdminProvidersStore.getState().q) setFilter("q", query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, setFilter]);

  const zoneOptions = [{ value: ANY, label: "Todas" }, ...(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))];

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-4">
      <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
        <span className="sr-only">Pesquisar por nome, telefone ou matrícula</span>
        <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
        <Input
          type="search"
          value={query}
          placeholder="Nome, telefone ou matrícula"
          onChange={(event) => setQuery(event.target.value)}
          className="h-[30px] pl-8 text-[13px]"
        />
      </label>
      <FilterMenu label="Estado" value={state.status} options={STATUS_OPTIONS} onChange={(value) => setFilter("status", value as ProvidersFilterState["status"])} />
      <FilterMenu label="Verificação" value={state.verified} options={VERIFIED_OPTIONS} onChange={(value) => setFilter("verified", value as ProvidersFilterState["verified"])} />
      <FilterMenu label="Zona" value={state.zone} options={zoneOptions} onChange={(value) => setFilter("zone", value)} />
      <FilterMenu label="Serviço" value={state.service} options={SERVICE_OPTIONS} onChange={(value) => setFilter("service", value as ProvidersFilterState["service"])} />
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
  );
}
