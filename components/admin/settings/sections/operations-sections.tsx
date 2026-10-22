"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import Field from "@/components/_ui/field";
import { DISPATCH_FALLBACK_LABELS } from "@/lib/leva-ja/settings";
import { DOCUMENT_TITLES, SERVICE_LABELS, VEHICLE_CLASS_LABELS } from "@/lib/leva-ja/services";
import { formatKz } from "@/lib/format";
import type { PlatformSettings, VehicleClass } from "@/types/leva-ja";
import SectionForm from "../section-form";
import { CheckField, FieldGrid, NumberField, toggle } from "./fields";

type Props = { settings: PlatformSettings; canEdit: boolean };

const VEHICLES = Object.keys(VEHICLE_CLASS_LABELS) as VehicleClass[];

export function ServicesSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="services" settings={settings} canEdit={canEdit} description="Serviços disponíveis na app e as categorias de viatura que podem prestar cada um.">
      {({ draft, replace, issueFor, disabled }) => (
        <ul className="divide-border flex flex-col divide-y">
          {draft.map((service) => (
            <li key={service.kind} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
              <CheckField
                checked={service.enabled}
                disabled={disabled}
                onChange={(enabled) => replace(draft.map((item) => (item.kind === service.kind ? { ...item, enabled } : item)))}
              >
                <span className="lead-style text-foreground">{SERVICE_LABELS[service.kind]}</span>
              </CheckField>
              <div className="flex flex-wrap gap-4 pl-6" role="group" aria-label={`Viaturas para ${SERVICE_LABELS[service.kind]}`}>
                {VEHICLES.map((vehicle) => (
                  <CheckField
                    key={vehicle}
                    checked={service.vehicleClasses.includes(vehicle)}
                    disabled={disabled || !service.enabled}
                    onChange={(on) =>
                      replace(draft.map((item) => (item.kind === service.kind ? { ...item, vehicleClasses: toggle(item.vehicleClasses, vehicle, on) } : item)))
                    }
                  >
                    {VEHICLE_CLASS_LABELS[vehicle]}
                  </CheckField>
                ))}
              </div>
              {issueFor(`services.${service.kind}`) && <span className="caption-style text-danger pl-6">{issueFor(`services.${service.kind}`)}</span>}
            </li>
          ))}
          {issueFor("services") && <li className="caption-style text-danger pt-3">{issueFor("services")}</li>}
        </ul>
      )}
    </SectionForm>
  );
}

export function DispatchSection({ settings, canEdit }: Props) {
  return (
    <SectionForm
      section="dispatch"
      settings={settings}
      canEdit={canEdit}
      description="Como os pedidos são oferecidos aos prestadores e a partir de quando precisam de atenção da equipa."
    >
      {({ draft, update, issueFor }) => (
        <>
          <FieldGrid>
            <NumberField id="dispatch-initial" label="Raio inicial (km)" value={draft.initialRadiusKm} onChange={(initialRadiusKm) => update({ initialRadiusKm })} error={issueFor("initialRadiusKm")} />
            <NumberField
              id="dispatch-max"
              label="Raio máximo (km)"
              value={draft.maxRadiusKm}
              onChange={(maxRadiusKm) => update({ maxRadiusKm })}
              error={issueFor("maxRadiusKm")}
              hint="Prestadores mais longe não podem receber o pedido, nem por reatribuição."
            />
            <NumberField id="dispatch-timeout" label="Tempo para aceitar (s)" value={draft.offerTimeoutSeconds} onChange={(offerTimeoutSeconds) => update({ offerTimeoutSeconds })} error={issueFor("offerTimeoutSeconds")} />
            <NumberField id="dispatch-attempts" label="Tentativas antes de desistir" value={draft.maxAttempts} onChange={(maxAttempts) => update({ maxAttempts })} error={issueFor("maxAttempts")} />
            <NumberField
              id="dispatch-stalled"
              label="Pedido parado ao fim de (min)"
              value={draft.stalledAfterMinutes}
              onChange={(stalledAfterMinutes) => update({ stalledAfterMinutes })}
              error={issueFor("stalledAfterMinutes")}
              hint="Aparece em «Precisa de atenção» na visão geral."
            />
            <NumberField id="dispatch-weight" label="Peso da distância (%)" value={draft.distanceWeight} onChange={(distanceWeight) => update({ distanceWeight })} error={issueFor("distanceWeight")} hint="O resto do peso vai para a avaliação do prestador." />
            <NumberField id="dispatch-assign-target" label="Prazo de atribuição (min)" value={draft.assignTargetMinutes} onChange={(assignTargetMinutes) => update({ assignTargetMinutes })} error={issueFor("assignTargetMinutes")} />
            <NumberField id="dispatch-arrival-target" label="Prazo de chegada (min)" value={draft.arrivalTargetMinutes} onChange={(arrivalTargetMinutes) => update({ arrivalTargetMinutes })} error={issueFor("arrivalTargetMinutes")} />
          </FieldGrid>
          <Field label="Quando nenhum prestador aceita" htmlFor="dispatch-fallback">
            <Select value={draft.fallback} onValueChange={(value) => update({ fallback: value as typeof draft.fallback })}>
              <SelectTrigger id="dispatch-fallback" className="sm:max-w-[360px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DISPATCH_FALLBACK_LABELS) as (keyof typeof DISPATCH_FALLBACK_LABELS)[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {DISPATCH_FALLBACK_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function CancellationSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="cancellation" settings={settings} canEdit={canEdit} description="Custos para o cliente que cancela ou faz esperar, e limites para os prestadores que cancelam.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <FieldGrid>
            <NumberField id="cancel-free" label="Cancelamento grátis até (min)" value={draft.clientFreeMinutes} onChange={(clientFreeMinutes) => update({ clientFreeMinutes })} error={issueFor("clientFreeMinutes")} hint="Contados desde a atribuição do prestador." />
            <NumberField id="cancel-fee" label="Taxa de cancelamento (Kz)" value={draft.clientFee} onChange={(clientFee) => update({ clientFee })} error={issueFor("clientFee")} />
            <NumberField id="cancel-wait" label="Tolerância de espera no local (min)" value={draft.waitToleranceMinutes} onChange={(waitToleranceMinutes) => update({ waitToleranceMinutes })} error={issueFor("waitToleranceMinutes")} />
            <NumberField id="cancel-wait-fee" label="Espera por minuto (Kz)" value={draft.waitFeePerMinute} onChange={(waitFeePerMinute) => update({ waitFeePerMinute })} error={issueFor("waitFeePerMinute")} />
            <NumberField id="cancel-provider-limit" label="Cancelamentos do prestador por semana" value={draft.providerCancelLimit} onChange={(providerCancelLimit) => update({ providerCancelLimit })} error={issueFor("providerCancelLimit")} />
          </FieldGrid>
          <CheckField checked={draft.providerAutoSuspend} disabled={disabled} onChange={(providerAutoSuspend) => update({ providerAutoSuspend })}>
            Suspender automaticamente o prestador que passe o limite
          </CheckField>
          <p className="caption-style text-subtle">
            Exemplo: um cliente que cancela {draft.clientFreeMinutes + 2} minutos depois da atribuição paga {formatKz(Number.isNaN(draft.clientFee) ? 0 : draft.clientFee)}.
          </p>
        </>
      )}
    </SectionForm>
  );
}

export function DocumentsSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="documents" settings={settings} canEdit={canEdit} description="Documentos que um prestador tem de ter verificados para receber pedidos.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <ul className="divide-border flex flex-col divide-y">
            {draft.requirements.map((requirement) => (
              <li key={requirement.icon} className="grid items-end gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_220px]">
                <CheckField
                  checked={requirement.required}
                  disabled={disabled}
                  onChange={(required) => update({ requirements: draft.requirements.map((item) => (item.icon === requirement.icon ? { ...item, required } : item)) })}
                >
                  <span className="lead-style text-foreground">{DOCUMENT_TITLES[requirement.icon]}</span> obrigatório
                </CheckField>
                <NumberField
                  id={`document-${requirement.icon}`}
                  label="Validade mínima ao aprovar (dias)"
                  value={requirement.minValidityDays}
                  error={issueFor(`requirements.${requirement.icon}`)}
                  onChange={(minValidityDays) => update({ requirements: draft.requirements.map((item) => (item.icon === requirement.icon ? { ...item, minValidityDays } : item)) })}
                />
              </li>
            ))}
          </ul>
          {issueFor("requirements") && <span className="caption-style text-danger">{issueFor("requirements")}</span>}
          <div className="sm:max-w-[280px]">
            <NumberField
              id="documents-warning"
              label="Avisar quando expira em (dias)"
              value={draft.expiryWarningDays}
              onChange={(expiryWarningDays) => update({ expiryWarningDays })}
              error={issueFor("expiryWarningDays")}
              hint="Usado no alerta da validação de documentos."
            />
          </div>
        </>
      )}
    </SectionForm>
  );
}
