"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import type { FieldIssue } from "@/data/leva-ja";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateZone, useUpdateZone } from "@/hooks/admin/use-pricing";
import type { Zone } from "@/types/leva-ja";

type Props = { zone: Zone | null; onClose: () => void };

function parse(raw: string) {
  const value = Number(raw.replace(",", "."));
  return raw.trim() === "" ? Number.NaN : value;
}

export default function ZoneDialog({ zone, onClose }: Props) {
  const create = useCreateZone();
  const update = useUpdateZone();
  const mutation = zone ? update : create;
  const [name, setName] = useState(zone?.name ?? "");
  const [latitude, setLatitude] = useState(zone ? String(zone.coords.latitude) : "-8.9");
  const [longitude, setLongitude] = useState(zone ? String(zone.coords.longitude) : "13.25");
  const [radius, setRadius] = useState(zone ? String(zone.radiusKm) : "3");
  const issues: FieldIssue[] = isRepositoryError(mutation.error) ? mutation.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const generalError = issues.length ? null : mutationError(mutation.error);

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={zone ? `Editar a zona ${zone.name}` : "Nova zona"}
      description="Os prestadores só recebem pedidos das zonas que cobrem. O centro e o raio definem a área da zona."
      confirmLabel={zone ? "Guardar zona" : "Criar zona"}
      requireReason
      reasonLabel="Motivo"
      pending={mutation.isPending}
      error={generalError}
      onConfirm={(reason) => {
        const input = { name, coords: { latitude: parse(latitude), longitude: parse(longitude) }, radiusKm: parse(radius) };
        const request = zone ? update.mutateAsync({ id: zone.id, input, reason }) : create.mutateAsync({ input, reason });
        return request.then(onClose, () => undefined);
      }}
    >
      <Field label="Nome" htmlFor="zone-name" required error={issueFor("name")}>
        <Input id="zone-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Latitude" htmlFor="zone-lat" required error={issueFor("latitude")}>
          <Input id="zone-lat" inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="tabular-nums" />
        </Field>
        <Field label="Longitude" htmlFor="zone-lng" required error={issueFor("longitude")}>
          <Input id="zone-lng" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="tabular-nums" />
        </Field>
        <Field label="Raio (km)" htmlFor="zone-radius" required error={issueFor("radiusKm")}>
          <Input id="zone-radius" inputMode="decimal" value={radius} onChange={(event) => setRadius(event.target.value)} className="tabular-nums" />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
