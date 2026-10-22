"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCreateRefund } from "@/hooks/admin/use-refunds";
import { formatKz, parseKz } from "@/lib/format";
import type { ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; refundable: number; open: boolean; onOpenChange: (open: boolean) => void };

export default function RequestRefundDialog({ request, refundable, open, onOpenChange }: Props) {
  const create = useCreateRefund();
  const [amount, setAmount] = useState(String(refundable));
  const [chargeProvider, setChargeProvider] = useState(false);
  const value = parseKz(amount);
  const amountError =
    !Number.isInteger(value) || value <= 0
      ? "Indique um valor inteiro maior que zero."
      : value > refundable
        ? `O máximo por reembolsar é ${formatKz(refundable)}.`
        : undefined;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          create.reset();
          setAmount(String(refundable));
          setChargeProvider(false);
        }
      }}
      title={`Pedir reembolso do pedido ${request.code}`}
      description={`O cliente pagou ${formatKz(request.price.total)}. Falta reembolsar no máximo ${formatKz(refundable)}. O pedido segue para aprovação das Finanças.`}
      confirmLabel="Pedir reembolso"
      requireReason
      reasonLabel="Motivo do reembolso"
      reasonPlaceholder="Por exemplo: o prestador não chegou ao local."
      canConfirm={!amountError}
      pending={create.isPending}
      error={mutationError(create.error)}
      onConfirm={(reason) =>
        create.mutateAsync({ requestId: request.id, amount: value, reason, chargeProvider }).then(() => onOpenChange(false), () => undefined)
      }
    >
      <Field label="Valor a devolver (Kz)" htmlFor="refund-amount" required error={amountError}>
        <Input id="refund-amount" inputMode="numeric" value={amount} aria-invalid={Boolean(amountError)} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
      </Field>
      {request.provider && (
        <label className="caption-style text-soft flex cursor-pointer items-start gap-2">
          <Checkbox checked={chargeProvider} onCheckedChange={(next) => setChargeProvider(next === true)} className="mt-0.5" />
          <span>
            Imputar ao prestador ({request.provider.name}). O valor é descontado à carteira quando o reembolso for pago.
          </span>
        </label>
      )}
    </ConfirmDialog>
  );
}
