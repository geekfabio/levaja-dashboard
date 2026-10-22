"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import FilterMenu from "@/components/_common/filter-menu";
import {
  COMPANY_OPTIONS,
  OWNER_OPTIONS,
  TYPE_OPTIONS,
  WINDOW_OPTIONS,
} from "./filter-options";
import { useActivitiesStore } from "@/stores/activities-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import CheckSquareIcon from "@/public/assets/images/companies/table/check-square.svg";

export default function ActivitiesToolbar() {
  const view = useActivitiesStore((state) => state.view);
  const type = useActivitiesStore((state) => state.type);
  const owner = useActivitiesStore((state) => state.owner);
  const companyId = useActivitiesStore((state) => state.companyId);
  const window_ = useActivitiesStore((state) => state.window);
  const search = useActivitiesStore((state) => state.search);
  const setType = useActivitiesStore((state) => state.setType);
  const setOwner = useActivitiesStore((state) => state.setOwner);
  const setCompanyId = useActivitiesStore((state) => state.setCompanyId);
  const setWindow = useActivitiesStore((state) => state.setWindow);
  const setSearch = useActivitiesStore((state) => state.setSearch);
  const setNewActivityOpen = useActivitiesStore(
    (state) => state.setNewActivityOpen,
  );
  const setNewTaskOpen = useActivitiesStore((state) => state.setNewTaskOpen);

  if (view === "rota") return null;

  const showType = view === "lista" || view === "calendario";
  const showWindow = view === "lista" || view === "calendario";

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Pesquisar atividades"
          data-page-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar cliente ou nota…"
          className="h-[30px] w-full sm:w-[220px]"
        />
        {showType && (
          <FilterMenu
            label="Tipo"
            value={type}
            options={TYPE_OPTIONS}
            onChange={setType}
          />
        )}
        <FilterMenu
          label="Gestor"
          value={owner}
          options={OWNER_OPTIONS}
          onChange={setOwner}
        />
        <FilterMenu
          label="Cliente"
          value={companyId}
          options={COMPANY_OPTIONS}
          onChange={setCompanyId}
        />
        {showWindow && (
          <FilterMenu
            label="Janela"
            value={window_}
            options={WINDOW_OPTIONS}
            onChange={setWindow}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setNewTaskOpen(true)}
        >
          <CheckSquareIcon aria-hidden className="size-3" />
          Nova Tarefa
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setNewActivityOpen(true)}
        >
          <PlusIcon aria-hidden className="size-3" />
          Novo Registo
        </Button>
      </div>
    </div>
  );
}
