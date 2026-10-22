"use client";

import Field from "@/components/_ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { formatKz } from "@/lib/format";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/leva-ja/services";
import { PAYOUT_FREQUENCY_LABELS } from "@/lib/leva-ja/settings";
import type { PlatformSettings } from "@/types/leva-ja";
import SectionForm from "../section-form";
import { CheckField, FieldGrid, NumberField, TextField, toggle } from "./fields";

type Props = { settings: PlatformSettings; canEdit: boolean };

export function PayoutsSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="payouts" settings={settings} canEdit={canEdit} description="Métodos aceites na app e regras dos levantamentos dos prestadores.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <div className="flex flex-col gap-2">
            <span className="caption-style text-soft">Métodos de pagamento activos</span>
            <div className="flex flex-wrap gap-4">
              {PAYMENT_METHODS.map((method) => (
                <CheckField key={method} checked={draft.methods.includes(method)} disabled={disabled} onChange={(on) => update({ methods: toggle(draft.methods, method, on) })}>
                  {PAYMENT_LABELS[method]}
                </CheckField>
              ))}
            </div>
            {issueFor("methods") && <span className="caption-style text-danger">{issueFor("methods")}</span>}
          </div>
          <FieldGrid>
            <NumberField id="payout-minimum" label="Levantamento mínimo (Kz)" value={draft.minimumWithdrawal} onChange={(minimumWithdrawal) => update({ minimumWithdrawal })} error={issueFor("minimumWithdrawal")} hint={`Actualmente ${formatKz(settings.payouts.minimumWithdrawal)}.`} />
            <Field label="Frequência dos pagamentos" htmlFor="payout-frequency">
              <Select value={draft.payoutFrequency} onValueChange={(value) => update({ payoutFrequency: value as typeof draft.payoutFrequency })}>
                <SelectTrigger id="payout-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYOUT_FREQUENCY_LABELS) as (keyof typeof PAYOUT_FREQUENCY_LABELS)[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PAYOUT_FREQUENCY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField id="payout-entity" label="Entidade Multicaixa" value={draft.multicaixaEntity} onChange={(multicaixaEntity) => update({ multicaixaEntity })} error={issueFor("multicaixaEntity")} />
            <NumberField
              id="payout-cash-days"
              label="Prazo para entregar o numerário (dias)"
              value={draft.cashSettlementDays}
              onChange={(cashSettlementDays) => update({ cashSettlementDays })}
              error={issueFor("cashSettlementDays")}
              hint="Comissão de serviços pagos em numerário que o prestador tem de entregar."
            />
          </FieldGrid>
        </>
      )}
    </SectionForm>
  );
}

export function TaxSection({ settings, canEdit }: Props) {
  return (
    <SectionForm section="tax" settings={settings} canEdit={canEdit} description="IVA e séries dos documentos fiscais emitidos para os clientes.">
      {({ draft, update, issueFor, disabled }) => (
        <>
          <FieldGrid>
            <NumberField id="tax-vat" label="IVA (%)" value={draft.vatRate} scale={100} onChange={(vatRate) => update({ vatRate })} error={issueFor("vatRate")} />
            <TextField id="tax-invoice" label="Série das facturas" value={draft.invoiceSeries} onChange={(invoiceSeries) => update({ invoiceSeries })} error={issueFor("invoiceSeries")} />
            <TextField id="tax-credit" label="Série das notas de crédito" value={draft.creditNoteSeries} onChange={(creditNoteSeries) => update({ creditNoteSeries })} error={issueFor("creditNoteSeries")} />
          </FieldGrid>
          <CheckField checked={draft.vatOnReceipts} disabled={disabled} onChange={(vatOnReceipts) => update({ vatOnReceipts })}>
            Discriminar o IVA nos recibos enviados aos clientes
          </CheckField>
        </>
      )}
    </SectionForm>
  );
}
