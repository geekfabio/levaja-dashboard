"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import LuandaMap from "@/components/admin/shared/luanda-map";
import { errorMessage } from "@/data/leva-ja";
import type { ZoneWithStats } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useRemoveZone } from "@/hooks/admin/use-pricing";
import { useZones } from "@/hooks/admin/use-zones";
import { formatDecimal, formatNumber } from "@/lib/format";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import ZoneDialog from "./zone-dialog";

export default function ZonesPanel({ canEdit }: { canEdit: boolean }) {
  const zones = useZones();
  const remove = useRemoveZone();
  const [editing, setEditing] = useState<ZoneWithStats | "new" | null>(null);
  const [removing, setRemoving] = useState<ZoneWithStats | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <SettingsPanel
        title="Zonas de cobertura"
        description="Uma zona com prestadores ou pedidos activos não pode ser removida."
        className="bg-card"
        actions={
          canEdit ? (
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <PlusIcon aria-hidden className="size-3" />
              Nova zona
            </Button>
          ) : undefined
        }
      >
        <AsyncState query={zones} skeleton={<Skeleton className="h-72" />} errorDescription={errorMessage} isEmpty={(items) => items.length === 0} empty={{ title: "Sem zonas" }}>
          {(items) => (
            <div className="overflow-x-auto">
              <Table aria-label="Zonas">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Zona</TableHead>
                    <TableHead scope="col">Centro</TableHead>
                    <TableHead scope="col" className="text-right">
                      Raio
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Prestadores
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Pedidos activos
                    </TableHead>
                    {canEdit && (
                      <TableHead scope="col">
                        <span className="sr-only">Acções</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((zone) => {
                    const inUse = zone.providersCount > 0 || zone.activeRequests > 0;
                    return (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">{zone.name}</TableCell>
                        <TableCell className="text-soft caption-style tabular-nums">
                          {formatDecimal(zone.coords.latitude, 4)}, {formatDecimal(zone.coords.longitude, 4)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatDecimal(zone.radiusKm, 1)} km</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(zone.providersCount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(zone.activeRequests)}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <span className="flex justify-end gap-1.5">
                              <Button variant="secondary" size="sm" onClick={() => setEditing(zone)} aria-label={`Editar ${zone.name}`}>
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoving(zone)}
                                disabled={inUse}
                                title={inUse ? "Tem prestadores ou pedidos activos" : undefined}
                                aria-label={inUse ? `Não é possível remover ${zone.name}: tem prestadores ou pedidos activos` : `Remover ${zone.name}`}
                              >
                                Remover
                              </Button>
                            </span>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </AsyncState>
      </SettingsPanel>
      <SettingsPanel title="Mapa das zonas" className="bg-card">
        <div className="border-border aspect-square overflow-hidden rounded-xl border">
          <LuandaMap zones={zones.data ?? []} markers={[]} ariaLabel={`Zonas de Luanda: ${(zones.data ?? []).map((zone) => zone.name).join(", ")}`} className="rounded-none" />
        </div>
      </SettingsPanel>

      {editing && <ZoneDialog key={editing === "new" ? "new" : editing.id} zone={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            remove.reset();
          }
        }}
        title={removing ? `Remover a zona ${removing.name}?` : "Remover zona"}
        description="A zona deixa de estar disponível para novos pedidos e para a cobertura dos prestadores."
        confirmLabel="Remover zona"
        tone="danger"
        requireReason
        pending={remove.isPending}
        error={mutationError(remove.error)}
        onConfirm={(reason) => (removing ? remove.mutateAsync({ id: removing.id, reason, name: removing.name }).then(() => setRemoving(null), () => undefined) : undefined)}
      />
    </div>
  );
}
