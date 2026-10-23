"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import DetailList from "@/components/admin/shared/detail-list";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useRegisterSettlement, useResolveSettlement } from "@/hooks/admin/use-billing";
import { formatDateNumeric, formatKz, formatNumber, parseKz } from "@/lib/format";
import { SETTLEMENT_METHOD_LABELS } from "@/lib/leva-ja/billing";
import type { Settlement } from "@/types/leva-ja";

export type SettlementAction = "register" | "resolve";

function Summary({ settlement }: { settlement: Settlement }) {
  return (
    <DetailList
      items={[
        { label: "Dia", value: formatDateNumeric(settlement.day) },
        { label: "Canal", value: SETTLEMENT_METHOD_LABELS[settlement.method] },
        { label: "Esperado", value: `${formatKz(settlement.expected)} · ${formatNumber(settlement.count)} pagamento(s)` },
        { label: "Recebido", value: settlement.received === null ? "—" : formatKz(settlement.received) },
      ]}
    />
  );
}

export default function SettlementDialog({ settlement, action, onClose }: { settlement: Settlement; action: SettlementAction; onClose: () => void }) {
  const register = useRegisterSettlement();
  const resolve = useResolveSettlement();
  const [amount, setAmount] = useState(String(settlement.expected));
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const close = (open: boolean) => {
    if (!open) onClose();
  };

  if (action === "resolve") {
    const difference = (settlement.received ?? 0) - settlement.expected;
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title="Justificar diferença"
        description={`O extracto tem ${formatKz(difference)} ${difference < 0 ? "a menos" : "a mais"} do que os pagamentos registados neste dia.`}
        confirmLabel="Justificar"
        requireReason
        reasonLabel="Justificação"
        reasonPlaceholder="Por exemplo: comissão da gateway descontada no extracto."
        pending={resolve.isPending}
        error={mutationError(resolve.error)}
        onConfirm={(resolution) => resolve.mutateAsync({ id: settlement.id, resolution }).then(onClose, () => undefined)}
      >
        <Summary settlement={settlement} />
      </ConfirmDialog>
    );
  }

  const value = parseKz(amount);
  const amountError = touched && (!Number.isInteger(value) || value < 0) ? "Indique o valor recebido em kwanzas." : undefined;
  const referenceError = touched && reference.trim().length < 3 ? "Indique a referência do extracto." : undefined;
  return (
    <ConfirmDialog
      open
      onOpenChange={close}
      title="Registar recebimento"
      description="Indique o valor que entrou na conta, tal como aparece no extracto bancário."
      confirmLabel="Registar"
      pending={register.isPending}
      error={mutationError(register.error)}
      onConfirm={() => {
        setTouched(true);
        if (!Number.isInteger(value) || value < 0 || reference.trim().length < 3) return;
        return register.mutateAsync({ id: settlement.id, amount: value, reference: reference.trim() }).then(onClose, () => undefined);
      }}
    >
      <Summary settlement={settlement} />
      <Field label="Valor recebido (Kz)" htmlFor="settlement-amount" required error={amountError}>
        <Input id="settlement-amount" inputMode="numeric" value={amount} aria-invalid={Boolean(amountError)} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
      </Field>
      <Field label="Referência do extracto" htmlFor="settlement-reference" required error={referenceError}>
        <Input id="settlement-reference" value={reference} placeholder="Por exemplo: EMIS-20261021-412" aria-invalid={Boolean(referenceError)} onChange={(event) => setReference(event.target.value)} autoFocus />
      </Field>
    </ConfirmDialog>
  );
}
