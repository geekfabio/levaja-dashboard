"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import DetailList from "@/components/admin/shared/detail-list";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCashDeposits, useRegisterCashDeposit } from "@/hooks/admin/use-billing";
import { formatDateTimeNumeric, formatKz, parseKz } from "@/lib/format";
import type { CashDebt } from "@/types/leva-ja";

export default function CashDepositDialog({ debt, canManage, onClose }: { debt: CashDebt; canManage: boolean; onClose: () => void }) {
  const register = useRegisterCashDeposit();
  const deposits = useCashDeposits(debt.providerId);
  const [amount, setAmount] = useState(String(Math.max(0, debt.balance)));
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const value = parseKz(amount);
  const amountError =
    touched && (!Number.isInteger(value) || value <= 0)
      ? "Indique um valor inteiro maior que zero."
      : touched && value > debt.balance
        ? `O máximo em dívida é ${formatKz(debt.balance)}.`
        : undefined;
  const referenceError = touched && reference.trim().length < 3 ? "Indique a referência do depósito." : undefined;
  const history = (
    <section aria-label="Entregas anteriores" className="flex flex-col gap-2">
      <h3 className="eyebrow-style text-faint font-normal">Entregas anteriores</h3>
      {deposits.data?.length ? (
        <ul className="divide-border flex flex-col divide-y">
          {deposits.data.slice(0, 5).map((deposit) => (
            <li key={deposit.id} className="caption-style flex justify-between gap-3 py-1.5 tabular-nums">
              <span className="text-soft">
                {formatDateTimeNumeric(deposit.at)} · {deposit.reference}
              </span>
              <span>{formatKz(deposit.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption-style text-subtle">{deposits.isPending ? "A carregar…" : "Ainda sem entregas registadas."}</p>
      )}
    </section>
  );
  const summary = (
    <DetailList
      items={[
        { label: "Cobrado em numerário", value: formatKz(debt.owed) },
        { label: "Já entregue", value: formatKz(debt.deposited) },
        { label: "Em dívida", value: formatKz(debt.balance) },
        { label: "Mais antigo por entregar", value: debt.oldestUnsettledAt ? formatDateTimeNumeric(debt.oldestUnsettledAt) : "—" },
      ]}
    />
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Numerário de ${debt.providerName}`}
      description="Taxa e comissão dos serviços pagos em numerário, que o prestador recebeu e tem de entregar à plataforma."
      confirmLabel={canManage && debt.balance > 0 ? "Registar entrega" : "Fechar"}
      pending={register.isPending}
      error={mutationError(register.error)}
      onConfirm={() => {
        if (!canManage || debt.balance <= 0) {
          onClose();
          return;
        }
        setTouched(true);
        if (!Number.isInteger(value) || value <= 0 || value > debt.balance || reference.trim().length < 3) return;
        return register.mutateAsync({ providerId: debt.providerId, amount: value, reference: reference.trim() }).then(onClose, () => undefined);
      }}
    >
      {summary}
      {canManage && debt.balance > 0 && (
        <>
          <Field label="Valor entregue (Kz)" htmlFor="cash-amount" required error={amountError}>
            <Input id="cash-amount" inputMode="numeric" value={amount} aria-invalid={Boolean(amountError)} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
          </Field>
          <Field label="Referência do depósito" htmlFor="cash-reference" required error={referenceError}>
            <Input id="cash-reference" value={reference} placeholder="Por exemplo: DEP482913" aria-invalid={Boolean(referenceError)} onChange={(event) => setReference(event.target.value)} />
          </Field>
        </>
      )}
      {history}
    </ConfirmDialog>
  );
}
