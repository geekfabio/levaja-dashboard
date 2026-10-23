"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useResolveDispute } from "@/hooks/admin/use-disputes";
import { formatKz, parseKz } from "@/lib/format";
import { DISPUTE_OUTCOME_LABELS } from "@/lib/leva-ja/refunds";
import type { DisputeOutcome, ServiceRequest } from "@/types/leva-ja";

type Props = {
  request: ServiceRequest;
  refundable: number;
  canRefund: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ResolveDisputeDialog({ request, refundable, canRefund, open, onOpenChange }: Props) {
  const resolve = useResolveDispute();
  const [outcome, setOutcome] = useState<DisputeOutcome>("no_refund");
  const [amount, setAmount] = useState("");
  const [chargeProvider, setChargeProvider] = useState(false);
  const refundAllowed = canRefund && refundable > 0;
  const value = parseKz(amount);
  const amountError =
    outcome !== "refund_partial"
      ? undefined
      : !Number.isInteger(value) || value <= 0
        ? "Indique um valor inteiro maior que zero."
        : value >= refundable
          ? `Tem de ser menor que ${formatKz(refundable)}. Para devolver tudo, escolha reembolso total.`
          : undefined;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resolve.reset();
          setOutcome("no_refund");
          setAmount("");
          setChargeProvider(false);
        }
      }}
      title={`Resolver disputa do pedido ${request.code}`}
      description={
        refundAllowed
          ? `Pode devolver até ${formatKz(refundable)}. Um reembolso fica por aprovar nas Finanças.`
          : refundable > 0
            ? "O seu papel não pode pedir reembolsos: a disputa só pode ser resolvida sem reembolso."
            : "O pedido não tem valor pago por reembolsar: a disputa só pode ser resolvida sem reembolso."
      }
      confirmLabel="Resolver disputa"
      requireReason
      reasonLabel="Resolução"
      reasonPlaceholder="Explique a decisão. Fica registada na auditoria e no pedido."
      canConfirm={!amountError}
      pending={resolve.isPending}
      error={mutationError(resolve.error)}
      onConfirm={(resolution) =>
        resolve
          .mutateAsync({
            requestId: request.id,
            input: { outcome, resolution, amount: outcome === "refund_partial" ? value : undefined, chargeProvider: outcome !== "no_refund" && chargeProvider },
          })
          .then(() => onOpenChange(false), () => undefined)
      }
    >
      <Field label="Resultado" htmlFor="dispute-outcome">
        <Select value={outcome} onValueChange={(next) => setOutcome(next as DisputeOutcome)} disabled={!refundAllowed}>
          <SelectTrigger id="dispute-outcome">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DISPUTE_OUTCOME_LABELS) as DisputeOutcome[]).map((key) => (
              <SelectItem key={key} value={key}>
                {DISPUTE_OUTCOME_LABELS[key]}
                {key === "refund_full" && refundAllowed ? ` (${formatKz(refundable)})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {outcome === "refund_partial" && (
        <Field label="Valor a devolver (Kz)" htmlFor="dispute-amount" required error={amount ? amountError : undefined}>
          <Input id="dispute-amount" inputMode="numeric" value={amount} aria-invalid={Boolean(amount && amountError)} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
        </Field>
      )}
      {outcome !== "no_refund" && request.provider && (
        <label className="caption-style text-soft flex cursor-pointer items-start gap-2">
          <Checkbox checked={chargeProvider} onCheckedChange={(next) => setChargeProvider(next === true)} className="mt-0.5" />
          <span>Imputar ao prestador ({request.provider.name}). O valor sai da carteira quando o reembolso for pago.</span>
        </label>
      )}
    </ConfirmDialog>
  );
}
