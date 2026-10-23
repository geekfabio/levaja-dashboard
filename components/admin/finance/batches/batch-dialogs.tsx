"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import DetailList from "@/components/admin/shared/detail-list";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCancelBatch, useMarkBatchPaid, useSendBatch } from "@/hooks/admin/use-finance";
import { downloadCsv } from "@/lib/csv";
import { formatDateTimeNumeric, formatKz, formatNumber } from "@/lib/format";
import { BATCH_STATUS_LABELS, bankFileRows } from "@/lib/leva-ja/billing";
import type { PayoutBatch } from "@/types/leva-ja";

export type BatchAction = "send" | "paid" | "cancel";

function Summary({ batch }: { batch: PayoutBatch }) {
  return (
    <DetailList
      items={[
        { label: "Lote", value: batch.code },
        { label: "Estado", value: BATCH_STATUS_LABELS[batch.status] },
        { label: "Levantamentos", value: formatNumber(batch.count) },
        { label: "Total", value: formatKz(batch.total) },
        { label: "Criado por", value: `${batch.createdBy} · ${formatDateTimeNumeric(batch.createdAt)}`, wide: true },
      ]}
    />
  );
}

export default function BatchDialog({ batch, action, onClose }: { batch: PayoutBatch; action: BatchAction; onClose: () => void }) {
  const send = useSendBatch();
  const paid = useMarkBatchPaid();
  const cancel = useCancelBatch();
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const close = (open: boolean) => {
    if (!open) onClose();
  };

  if (action === "send") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title={`Enviar ${batch.code} ao banco`}
        description="É descarregado o ficheiro de transferências (CSV) para carregar no banco. Depois do envio, os levantamentos ficam à espera da confirmação."
        confirmLabel="Descarregar e enviar"
        pending={send.isPending}
        error={mutationError(send.error)}
        onConfirm={() =>
          send.mutateAsync(batch.id).then((detail) => {
            downloadCsv(`${detail.code.toLowerCase()}-transferencias.csv`, bankFileRows(detail.withdrawals, detail.code));
            onClose();
          }, () => undefined)
        }
      >
        <Summary batch={batch} />
      </ConfirmDialog>
    );
  }

  if (action === "cancel") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title={`Cancelar ${batch.code}`}
        description="Os levantamentos voltam a ficar aprovados e podem entrar noutro lote."
        confirmLabel="Cancelar lote"
        tone="danger"
        requireReason
        reasonLabel="Motivo do cancelamento"
        pending={cancel.isPending}
        error={mutationError(cancel.error)}
        onConfirm={(reason) => cancel.mutateAsync({ id: batch.id, reason }).then(onClose, () => undefined)}
      >
        <Summary batch={batch} />
      </ConfirmDialog>
    );
  }

  const referenceError = touched && reference.trim().length < 3 ? "Indique a referência do banco." : undefined;
  return (
    <ConfirmDialog
      open
      onOpenChange={close}
      title={`Marcar ${batch.code} como pago`}
      description="Todos os levantamentos do lote ficam pagos com a referência do banco e saem da carteira dos prestadores."
      confirmLabel="Marcar como pago"
      pending={paid.isPending}
      error={mutationError(paid.error)}
      onConfirm={() => {
        setTouched(true);
        if (reference.trim().length < 3) return;
        return paid.mutateAsync({ id: batch.id, reference: reference.trim() }).then(onClose, () => undefined);
      }}
    >
      <Summary batch={batch} />
      <Field label="Referência do banco" htmlFor="batch-reference" required error={referenceError}>
        <Input id="batch-reference" value={reference} placeholder="Por exemplo: BAI482913" aria-invalid={Boolean(referenceError)} onChange={(event) => setReference(event.target.value)} autoFocus />
      </Field>
    </ConfirmDialog>
  );
}
