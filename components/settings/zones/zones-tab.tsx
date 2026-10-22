"use client";

import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { ZONE_DOTS } from "@/components/_common/sidebar/zone-dots";
import SettingsPanel from "../settings-panel";
import CommittedInput from "../committed-input";
import QuotaInput from "../quota-input";
import AddItemForm from "../add-item-form";
import { ZONE_COLORS, ZONE_COLOR_LABELS, type ZoneSetting } from "@/data/settings";
import { nameTaken } from "@/lib/settings";
import { renameZoneEverywhere } from "@/stores/rename-zone";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";

function clientsLabel(count: number) {
  return count === 1 ? "1 cliente" : `${count} clientes`;
}

function ZoneRow({ zone, clients, index }: { zone: ZoneSetting; clients: number; index: number }) {
  const zones = useSettingsStore((state) => state.zones);
  const updateZone = useSettingsStore((state) => state.updateZone);
  const removeZone = useSettingsStore((state) => state.removeZone);
  const Dot = ZONE_DOTS[zone.color];

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-2">
        <Dot aria-hidden className="mt-2 size-3.5 shrink-0" />
        <CommittedInput
          id={`zone-name-${index}`}
          label="Nome da zona"
          value={zone.name}
          className="min-w-[180px] flex-1"
          validate={(value) =>
            !value
              ? "Indique um nome."
              : nameTaken(zones.map((item) => item.name), value, zone.name)
                ? "Já existe uma zona com este nome."
                : undefined
          }
          onCommit={(name) => renameZoneEverywhere(zone.name, name)}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={clients > 0}
          title={clients > 0 ? "Mude os clientes desta zona primeiro." : undefined}
          onClick={() => removeZone(zone.name)}
        >
          Remover
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Cor da zona">
          {ZONE_COLORS.map((color) => {
            const Swatch = ZONE_DOTS[color];
            const selected = zone.color === color;
            return (
              <Button
                key={color}
                variant={selected ? "secondary" : "ghost"}
                size="icon-sm"
                role="radio"
                aria-checked={selected}
                aria-label={ZONE_COLOR_LABELS[color]}
                onClick={() => updateZone(zone.name, { color })}
              >
                <Swatch aria-hidden className={cn("size-3.5", !selected && "opacity-70")} />
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`zone-quota-${index}`} className="caption-style text-soft">
            Meta
          </label>
          <div className="w-[180px]">
            <QuotaInput
              id={`zone-quota-${index}`}
              label="Meta da zona"
              value={zone.quota}
              onChange={(quota) => updateZone(zone.name, { quota })}
            />
          </div>
        </div>
        <span className="caption-style text-subtle tabular-nums">{clientsLabel(clients)}</span>
        <label className="caption-style text-soft flex cursor-pointer items-center gap-2 sm:ml-auto">
          <Checkbox
            checked={zone.showInSidebar}
            onCheckedChange={(checked) =>
              updateZone(zone.name, { showInSidebar: checked === true })
            }
          />
          Mostrar na barra lateral
        </label>
      </div>
    </li>
  );
}

export default function ZonesTab() {
  const zones = useSettingsStore((state) => state.zones);
  const addZone = useSettingsStore((state) => state.addZone);
  const companies = useCompaniesStore((state) => state.companies);

  function clientCount(name: string) {
    return companies.filter((company) => company.zone === name).length;
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <SettingsPanel
        title={`Zonas · ${zones.length}`}
        description="Mudar o nome de uma zona atualiza os clientes, atividades, campanhas e automações que a usam. Só é possível remover zonas sem clientes."
      >
        <ul className="divide-border flex flex-col divide-y">
          {zones.map((zone, index) => (
            <ZoneRow key={zone.name} zone={zone} index={index} clients={clientCount(zone.name)} />
          ))}
        </ul>
        <AddItemForm
          id="new-zone"
          label="Nome da nova zona"
          placeholder="Nome da nova zona"
          buttonLabel="Adicionar zona"
          validate={(value) =>
            nameTaken(zones.map((item) => item.name), value)
              ? "Já existe uma zona com este nome."
              : undefined
          }
          onAdd={(name) =>
            addZone({
              name,
              color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
              quota: 0,
              showInSidebar: false,
            })
          }
        />
      </SettingsPanel>
    </div>
  );
}
