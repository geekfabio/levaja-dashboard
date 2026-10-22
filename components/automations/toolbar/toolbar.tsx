"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import FilterMenu from "@/components/_common/filter-menu";
import { ANY_CONDITION, AUTOMATION_STATUSES } from "@/data/automations";
import { useAutomationsStore } from "@/stores/automations-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const STATUS_OPTIONS = [
  { value: ANY_CONDITION, label: "Qualquer estado" },
  ...AUTOMATION_STATUSES.map((status) => ({ value: status, label: status })),
];

export default function AutomationsToolbar() {
  const status = useAutomationsStore((state) => state.status);
  const search = useAutomationsStore((state) => state.search);
  const weeklyCap = useAutomationsStore((state) => state.weeklyCap);
  const setStatusFilter = useAutomationsStore((state) => state.setStatusFilter);
  const setSearch = useAutomationsStore((state) => state.setSearch);
  const setWeeklyCap = useAutomationsStore((state) => state.setWeeklyCap);
  const createAutomation = useAutomationsStore((state) => state.createAutomation);

  return (
    <div className="flex shrink-0 flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Pesquisar automações"
            data-page-search
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar automação…"
            className="h-[30px] w-full sm:w-[220px]"
          />
          <FilterMenu
            label="Estado"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
        </div>
        <Button variant="primary" size="sm" onClick={createAutomation}>
          <PlusIcon aria-hidden className="size-3" />
          Nova Automação
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line-strong bg-white/3 px-4 py-3">
        <label htmlFor="weekly-cap" className="lead-style">
          Travão global
        </label>
        <Input
          id="weekly-cap"
          type="number"
          min={1}
          inputMode="numeric"
          value={weeklyCap}
          onChange={(event) => setWeeklyCap(Number(event.target.value) || 1)}
          className="h-[30px] w-16 tabular-nums"
        />
        <span className="caption-style text-subtle">
          mensagens por contacto por semana, somando e-mail e SMS de campanhas e
          automações.
        </span>
      </div>
    </div>
  );
}
