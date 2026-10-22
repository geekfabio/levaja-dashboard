"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import FilterMenu from "@/components/_common/filter-menu";
import { OWNER_OPTIONS, STAGE_OPTIONS } from "./filter-options";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import AlertIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";

export default function OpportunitiesToolbar() {
  const owner = useOpportunitiesStore((state) => state.owner);
  const stage = useOpportunitiesStore((state) => state.stage);
  const search = useOpportunitiesStore((state) => state.search);
  const setOwner = useOpportunitiesStore((state) => state.setOwner);
  const setStage = useOpportunitiesStore((state) => state.setStage);
  const setSearch = useOpportunitiesStore((state) => state.setSearch);
  const overdue = useOpportunitiesStore((state) => state.overdue);
  const setOverdue = useOpportunitiesStore((state) => state.setOverdue);
  const setNewOpportunityOpen = useOpportunitiesStore(
    (state) => state.setNewOpportunityOpen,
  );

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Pesquisar oportunidades"
          data-page-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar cliente ou contacto…"
          className="h-[30px] w-full sm:w-[220px]"
        />
        <FilterMenu
          label="Gestor"
          value={owner}
          options={OWNER_OPTIONS}
          onChange={setOwner}
        />
        <FilterMenu
          label="Fase"
          value={stage}
          options={STAGE_OPTIONS}
          onChange={setStage}
        />
        <Button
          variant={overdue ? "primary" : "secondary"}
          size="sm"
          aria-pressed={overdue}
          onClick={() => setOverdue(!overdue)}
        >
          <AlertIcon aria-hidden className="size-3" />
          Atrasadas
        </Button>
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={() => setNewOpportunityOpen(true)}
      >
        <PlusIcon aria-hidden className="size-3" />
        Nova Oportunidade
      </Button>
    </div>
  );
}
