"use client";

import LuandaMap from "@/components/admin/shared/luanda-map";
import Tag from "@/components/_ui/tag";
import { SERVICE_LABELS } from "@/lib/leva-ja/services";
import type { ProviderAccount, Zone } from "@/types/leva-ja";

export default function ProviderCoverage({ provider, zones }: { provider: ProviderAccount; zones: Zone[] }) {
  const covered = zones.filter((zone) => provider.zoneIds.includes(zone.id));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="border-border relative aspect-[4/3] overflow-hidden rounded-xl border">
        <LuandaMap
          zones={covered}
          markers={[{ id: provider.id, kind: "provider", coords: provider.coords, label: `Última posição de ${provider.name}` }]}
          fit={[provider.coords, ...covered.map((zone) => zone.coords)]}
          ariaLabel={`Zonas de cobertura de ${provider.name}: ${covered.map((zone) => zone.name).join(", ")}`}
          className="absolute inset-0 rounded-none"
        />
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h3 className="eyebrow-style text-faint font-normal">Zonas</h3>
          <ul className="flex flex-wrap gap-1.5">
            {covered.map((zone) => (
              <li key={zone.id}>
                <Tag tone="green" size="sm">
                  {zone.name}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="eyebrow-style text-faint font-normal">Serviços</h3>
          <ul className="flex flex-wrap gap-1.5">
            {provider.services.map((service) => (
              <li key={service}>
                <Tag tone="blue" size="sm">
                  {SERVICE_LABELS[service]}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
        <p className="caption-style text-subtle">
          Só recebe pedidos destas zonas e serviços, quando está online e com os quatro documentos verificados.
        </p>
      </div>
    </div>
  );
}
