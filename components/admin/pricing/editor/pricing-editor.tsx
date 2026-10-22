"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useUpdatePricing } from "@/hooks/admin/use-pricing";
import { formatDateTimeNumeric } from "@/lib/format";
import { pricingChanges, validatePricingConfig } from "@/lib/leva-ja/pricing";
import type { PricingEditable } from "@/lib/leva-ja/pricing";
import { SERVICE_KINDS, SERVICE_LABELS, SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import type { PricingConfig, ServiceKind } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import EstimatePreview from "./estimate-preview";

function toDraft(config: PricingConfig): PricingEditable {
  return structuredClone({
    rules: config.rules,
    extras: config.extras,
    platformFee: config.platformFee,
    commissionRate: config.commissionRate,
    roundTo: config.roundTo,
  });
}

function numberValue(raw: string) {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

export default function PricingEditor({ config, canEdit }: { config: PricingConfig; canEdit: boolean }) {
  const [draft, setDraft] = useState<PricingEditable>(() => toDraft(config));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = useUpdatePricing();
  const issues = validatePricingConfig(draft);
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const changes = pricingChanges(config, draft);
  const dirty = changes.length > 0;

  function setRule(kind: ServiceKind, field: "base" | "perKm", raw: string) {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.kind === kind ? { ...rule, [field]: numberValue(raw) } : rule)),
    }));
  }

  function setExtra(id: string, patch: Partial<PricingEditable["extras"][number]>) {
    setDraft((current) => ({ ...current, extras: current.extras.map((extra) => (extra.id === id ? { ...extra, ...patch } : extra)) }));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <SettingsPanel
          title="Preço por serviço"
          description="Valor do serviço = base + km × preço por km + extras, arredondado. O cliente paga ainda a taxa da plataforma."
          className="bg-card"
        >
          <div className="overflow-x-auto">
            <Table aria-label="Preço por serviço">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Serviço</TableHead>
                  <TableHead scope="col">Base (Kz)</TableHead>
                  <TableHead scope="col">Por km (Kz)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SERVICE_KINDS.map((kind) => {
                  const rule = draft.rules.find((item) => item.kind === kind);
                  if (!rule) return null;
                  const baseError = issueFor(`rules.${kind}.base`);
                  const kmError = issueFor(`rules.${kind}.perKm`);
                  return (
                    <TableRow key={kind}>
                      <TableCell className="font-medium">{SERVICE_LABELS[kind]}</TableCell>
                      <TableCell className="min-w-[140px]">
                        <Input
                          aria-label={`Preço base de ${SERVICE_LABELS[kind]}`}
                          inputMode="numeric"
                          value={Number.isNaN(rule.base) ? "" : String(rule.base)}
                          disabled={!canEdit}
                          aria-invalid={Boolean(baseError)}
                          title={baseError}
                          onChange={(event) => setRule(kind, "base", event.target.value)}
                          className="tabular-nums aria-invalid:border-danger"
                        />
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <Input
                          aria-label={`Preço por km de ${SERVICE_LABELS[kind]}`}
                          inputMode="numeric"
                          value={Number.isNaN(rule.perKm) ? "" : String(rule.perKm)}
                          disabled={!canEdit}
                          aria-invalid={Boolean(kmError)}
                          title={kmError}
                          onChange={(event) => setRule(kind, "perKm", event.target.value)}
                          className="tabular-nums aria-invalid:border-danger"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SettingsPanel>

        <SettingsPanel title="Taxa, comissão e arredondamento" className="bg-card">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Taxa da plataforma (Kz)" htmlFor="pricing-fee" error={issueFor("platformFee")}>
              <Input
                id="pricing-fee"
                inputMode="numeric"
                value={Number.isNaN(draft.platformFee) ? "" : String(draft.platformFee)}
                disabled={!canEdit}
                onChange={(event) => setDraft((current) => ({ ...current, platformFee: numberValue(event.target.value) }))}
              />
            </Field>
            <Field label="Comissão (%)" htmlFor="pricing-commission" error={issueFor("commissionRate")}>
              <Input
                id="pricing-commission"
                inputMode="decimal"
                value={Number.isNaN(draft.commissionRate) ? "" : String(Math.round(draft.commissionRate * 1000) / 10)}
                disabled={!canEdit}
                onChange={(event) => setDraft((current) => ({ ...current, commissionRate: numberValue(event.target.value) / 100 }))}
              />
            </Field>
            <Field label="Arredondar a (Kz)" htmlFor="pricing-round" error={issueFor("roundTo")}>
              <Input
                id="pricing-round"
                inputMode="numeric"
                value={Number.isNaN(draft.roundTo) ? "" : String(draft.roundTo)}
                disabled={!canEdit}
                onChange={(event) => setDraft((current) => ({ ...current, roundTo: numberValue(event.target.value) }))}
              />
            </Field>
          </div>
        </SettingsPanel>

        <SettingsPanel
          title="Extras"
          description="Valores somados ao serviço quando se aplicam ao pedido."
          className="bg-card"
          actions={
            canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    extras: [...current.extras, { id: `extra-${crypto.randomUUID().slice(0, 8)}`, label: "", amount: 0, kinds: ["cargo"] }],
                  }))
                }
              >
                <PlusIcon aria-hidden className="size-3" />
                Adicionar extra
              </Button>
            ) : undefined
          }
        >
          <ul className="divide-border flex flex-col divide-y">
            {draft.extras.map((extra, index) => (
              <li key={extra.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
                  <Field label="Nome" htmlFor={`extra-label-${index}`} error={issueFor(`extras.${extra.id}.label`)}>
                    <Input id={`extra-label-${index}`} value={extra.label} disabled={!canEdit} onChange={(event) => setExtra(extra.id, { label: event.target.value })} />
                  </Field>
                  <Field label="Valor (Kz)" htmlFor={`extra-amount-${index}`} error={issueFor(`extras.${extra.id}.amount`)}>
                    <Input
                      id={`extra-amount-${index}`}
                      inputMode="numeric"
                      value={Number.isNaN(extra.amount) ? "" : String(extra.amount)}
                      disabled={!canEdit}
                      onChange={(event) => setExtra(extra.id, { amount: numberValue(event.target.value) })}
                    />
                  </Field>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="md"
                      aria-label={`Remover o extra ${extra.label || index + 1}`}
                      onClick={() => setDraft((current) => ({ ...current, extras: current.extras.filter((item) => item.id !== extra.id) }))}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <fieldset className="flex flex-wrap items-center gap-4">
                  <legend className="sr-only">Serviços onde se aplica {extra.label}</legend>
                  {SERVICE_KINDS.map((kind) => (
                    <label key={kind} className="caption-style text-soft flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={extra.kinds.includes(kind)}
                        disabled={!canEdit}
                        onCheckedChange={(checked) =>
                          setExtra(extra.id, { kinds: checked === true ? [...extra.kinds, kind] : extra.kinds.filter((item) => item !== kind) })
                        }
                      />
                      {SERVICE_SHORT_LABELS[kind]}
                    </label>
                  ))}
                  {issueFor(`extras.${extra.id}.kinds`) && <span className="caption-style text-danger">{issueFor(`extras.${extra.id}.kinds`)}</span>}
                </fieldset>
              </li>
            ))}
          </ul>
        </SettingsPanel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <SettingsPanel title="Pré-visualização de estimativa" className="bg-card">
          <EstimatePreview draft={draft} current={config} />
        </SettingsPanel>
        <SettingsPanel title="Alterações" className="bg-card xl:sticky xl:top-0">
          <p className="caption-style text-subtle">
            Última alteração por {config.updatedBy} a {formatDateTimeNumeric(config.updatedAt)}.
          </p>
          {canEdit ? (
            <>
              {issues.length > 0 && (
                <p role="alert" className="caption-style text-danger">
                  {issues.length === 1 ? "Há 1 valor inválido." : `Há ${issues.length} valores inválidos.`} {issues[0].message}
                </p>
              )}
              <p className="caption-style text-soft" aria-live="polite">
                {dirty ? (changes.length === 1 ? "1 alteração por guardar." : `${changes.length} alterações por guardar.`) : "Sem alterações por guardar."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="md" disabled={!dirty || issues.length > 0} onClick={() => setConfirmOpen(true)}>
                  Guardar alterações
                </Button>
                <Button variant="ghost" size="md" disabled={!dirty} onClick={() => setDraft(toDraft(config))}>
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <p className="caption-style text-soft">O seu papel só pode consultar a tabela de preços.</p>
          )}
        </SettingsPanel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) mutation.reset();
        }}
        title="Guardar a nova tabela de preços?"
        description="As alterações aplicam-se aos pedidos criados a partir de agora e ficam registadas na auditoria."
        confirmLabel="Guardar"
        requireReason
        reasonLabel="Motivo da alteração"
        pending={mutation.isPending}
        error={mutationError(mutation.error)}
        onConfirm={(reason) => mutation.mutateAsync({ update: draft, reason }).then(() => setConfirmOpen(false), () => undefined)}
      >
        <ul className="caption-style text-soft flex max-h-[200px] flex-col gap-1 overflow-y-auto">
          {changes.map((change) => (
            <li key={change.field}>
              <span className="text-foreground">{change.field}:</span> {change.from} → {change.to}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
