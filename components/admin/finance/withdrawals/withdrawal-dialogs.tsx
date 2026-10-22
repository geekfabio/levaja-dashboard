"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import DetailList from "@/components/admin/shared/detail-list";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useApproveWithdrawal, useMarkWithdrawalPaid, useRejectWithdrawal } from "@/hooks/admin/use-finance";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import type { Withdrawal } from "@/types/leva-ja";

export type WithdrawalAction = "approve" | "reject" | "paid";

type Props = { withdrawal: Withdrawal; action: WithdrawalAction; onClose: () => void };

function Summary({ withdrawal }: { withdrawal: Withdrawal }) {
  return (
    <DetailList
      items={[
        { label: "Prestador", value: withdrawal.providerName },
        { label: "Valor", value: formatKz(withdrawal.amount) },
        { label: "IBAN", value: <span className="tabular-nums">{withdrawal.iban}</span>, wide: true },
        { label: "Pedido em", value: formatDateTimeNumeric(withdrawal.requestedAt) },
      ]}
    />
  );
}

export default function WithdrawalDialog({ withdrawal, action, onClose }: Props) {
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const paid = useMarkWithdrawalPaid();
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const close = (open: boolean) => {
    if (!open) onClose();
  };

  if (action === "approve") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title="Aprovar levantamento"
        description="O saldo disponível do prestador volta a ser confirmado antes de aprovar."
        confirmLabel="Aprovar"
        pending={approve.isPending}
        error={mutationError(approve.error)}
        onConfirm={() => approve.mutateAsync(withdrawal.id).then(onClose, () => undefined)}
      >
        <Summary withdrawal={withdrawal} />
      </ConfirmDialog>
    );
  }

  if (action === "reject") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title="Rejeitar levantamento"
        description="O valor volta a ficar disponível no saldo do prestador."
        confirmLabel="Rejeitar"
        tone="danger"
        requireReason
        reasonLabel="Motivo da rejeição"
        pending={reject.isPending}
        error={mutationError(reject.error)}
        onConfirm={(reason) => reject.mutateAsync({ id: withdrawal.id, reason }).then(onClose, () => undefined)}
      >
        <Summary withdrawal={withdrawal} />
      </ConfirmDialog>
    );
  }

  const referenceError = touched && reference.trim().length < 3 ? "Indique a referência da transferência." : undefined;
  return (
    <ConfirmDialog
      open
      onOpenChange={close}
      title="Marcar levantamento como pago"
      description="Confirme que a transferência foi feita. O valor é descontado ao saldo e fica registado na carteira do prestador."
      confirmLabel="Marcar como pago"
      pending={paid.isPending}
      error={mutationError(paid.error)}
      onConfirm={() => {
        setTouched(true);
        if (reference.trim().length < 3) return;
        return paid.mutateAsync({ id: withdrawal.id, reference: reference.trim() }).then(onClose, () => undefined);
      }}
    >
      <Summary withdrawal={withdrawal} />
      <Field label="Referência da transferência" htmlFor="withdrawal-reference" required error={referenceError}>
        <Input
          id="withdrawal-reference"
          value={reference}
          placeholder="Por exemplo: TRF482913"
          aria-invalid={Boolean(referenceError)}
          onChange={(event) => setReference(event.target.value)}
          onBlur={() => setTouched(true)}
          autoFocus
        />
      </Field>
    </ConfirmDialog>
  );
}
