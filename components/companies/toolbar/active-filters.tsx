"use client";

import Button from "@/components/_ui/button";
import { ALL_OWNERS, ALL_TEAMS, ANY_STAGE, ANY_ZONE, DEFAULT_FILTERS } from "@/lib/companies";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSettingsStore } from "@/stores/settings-store";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

type Chip = { key: string; label: string; clear: () => void };

export default function ActiveFilters() {
  const owner = useCompaniesStore((state) => state.owner);
  const stage = useCompaniesStore((state) => state.stage);
  const zone = useCompaniesStore((state) => state.zone);
  const team = useCompaniesStore((state) => state.team);
  const activityWindow = useCompaniesStore((state) => state.activityWindow);
  const teams = useSettingsStore((state) => state.teams);
  const resetFilters = useCompaniesStore((state) => state.resetFilters);

  const chips: Chip[] = [];
  const { setOwner, setStage, setZone, setTeam, setActivityWindow } = useCompaniesStore.getState();
  if (team !== ALL_TEAMS) {
    chips.push({
      key: "team",
      label: `Equipa: ${teams.find((item) => item.id === team)?.name ?? "—"}`,
      clear: () => setTeam(ALL_TEAMS),
    });
  }
  if (zone !== ANY_ZONE) chips.push({ key: "zone", label: `Zona: ${zone}`, clear: () => setZone(ANY_ZONE) });
  if (owner !== ALL_OWNERS) chips.push({ key: "owner", label: `Gestor: ${owner}`, clear: () => setOwner(ALL_OWNERS) });
  if (stage !== ANY_STAGE) chips.push({ key: "stage", label: `Fase: ${stage}`, clear: () => setStage(ANY_STAGE) });
  if (activityWindow !== DEFAULT_FILTERS.activityWindow) {
    chips.push({
      key: "window",
      label: `Atividade: ${activityWindow} dias`,
      clear: () => setActivityWindow(DEFAULT_FILTERS.activityWindow),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="-mt-1 flex flex-wrap items-center gap-1.5 px-4 pb-3" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <Button
          key={chip.key}
          variant="muted"
          size="sm"
          onClick={chip.clear}
          aria-label={`Remover filtro ${chip.label}`}
          className="gap-1 pr-1.5"
        >
          {chip.label}
          <XIcon aria-hidden className="size-3" />
        </Button>
      ))}
      {chips.length > 1 && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Limpar tudo
        </Button>
      )}
    </div>
  );
}
