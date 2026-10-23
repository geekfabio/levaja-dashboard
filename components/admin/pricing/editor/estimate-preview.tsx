"use client";

import { useState } from "react";
import Field from "@/components/_ui/field";
import { Checkbox } from "@/components/_ui/checkbox";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { formatKz } from "@/lib/format";
import { estimatePrice, validatePricingConfig } from "@/lib/leva-ja/pricing";
import type { PricingEditable } from "@/lib/leva-ja/pricing";
import { SERVICE_KINDS, SERVICE_LABELS } from "@/lib/leva-ja/services";
import type { PricingConfig, ServiceKind } from "@/types/leva-ja";

type Props = { draft: PricingEditable; current: PricingConfig };

export default function EstimatePreview({ draft, current }: Props) {
  const [kind, setKind] = useState<ServiceKind>("tow");
  const [distance, setDistance] = useState("12");
  const [extras, setExtras] = useState<string[]>([]);
  const km = Math.max(0, Number(distance.replace(",", ".")) || 0);
  const available = draft.extras.filter((extra) => extra.kinds.includes(kind));
  const extrasAmount = available.filter((extra) => extras.includes(extra.id)).reduce((sum, extra) => sum + extra.amount, 0);
  const valid = validatePricingConfig(draft).length === 0;
  const config = { ...current, ...draft };
  const next = valid ? estimatePrice(config, { kind, distanceKm: km, extrasAmount }) : null;
  const before = estimatePrice(current, { kind, distanceKm: km, extrasAmount });

  const rows = next
    ? [
        { label: "Base", value: next.breakdown.base },
        { label: `Distância (${distance || 0} km)`, value: next.breakdown.distance },
        { label: "Extras", value: next.breakdown.extras },
        { label: "Taxa da plataforma", value: next.breakdown.platformFee },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Serviço" htmlFor="estimate-kind">
          <Select value={kind} onValueChange={(value) => setKind(value as ServiceKind)}>
            <SelectTrigger id="estimate-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_KINDS.map((item) => (
                <SelectItem key={item} value={item}>
                  {SERVICE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Distância (km)" htmlFor="estimate-distance">
          <Input id="estimate-distance" inputMode="decimal" value={distance} onChange={(event) => setDistance(event.target.value)} />
        </Field>
      </div>
      {available.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="caption-style text-soft mb-2">Extras</legend>
          {available.map((extra) => (
            <label key={extra.id} className="caption-style text-soft flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={extras.includes(extra.id)}
                onCheckedChange={(checked) => setExtras((list) => (checked === true ? [...list, extra.id] : list.filter((id) => id !== extra.id)))}
              />
              {extra.label} · {formatKz(extra.amount)}
            </label>
          ))}
        </fieldset>
      )}
      {next ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <dl className="divide-border flex flex-col divide-y">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <dt className="caption-style text-soft">{row.label}</dt>
                <dd className="lead-style tabular-nums">{formatKz(row.value)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="lead-style font-medium">Total para o cliente</dt>
              <dd className="lead-style font-semibold tabular-nums">{formatKz(next.breakdown.total)}</dd>
            </div>
          </dl>
          <dl className="bg-muted/60 flex flex-col gap-2 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="caption-style text-soft">Ganho do prestador</dt>
              <dd className="caption-style tabular-nums">{formatKz(next.providerEarning)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="caption-style text-soft">Receita da plataforma</dt>
              <dd className="caption-style tabular-nums">{formatKz(next.platformRevenue)}</dd>
            </div>
            {before.breakdown.total !== next.breakdown.total && (
              <div className="flex items-center justify-between gap-3">
                <dt className="caption-style text-soft">Com a tabela actual</dt>
                <dd className="caption-style tabular-nums">{formatKz(before.breakdown.total)}</dd>
              </div>
            )}
          </dl>
          <p className="caption-style text-subtle">Valor do serviço arredondado a múltiplos de {formatKz(draft.roundTo)}.</p>
        </div>
      ) : (
        <p role="status" className="caption-style text-danger">
          Corrija os valores da tabela para ver a estimativa.
        </p>
      )}
    </div>
  );
}
