"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import DetailList from "@/components/admin/shared/detail-list";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useApproveRefund, useMarkRefundPaid, useRejectRefund } from "@/hooks/admin/use-refunds";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { REFUND_SOURCE_LABELS } from "@/lib/leva-ja/refunds";
import { PAYMENT_LABELS } from "@/lib/leva-ja/services";
import type { Refund } from "@/types/leva-ja";

export type RefundAction = "approve" | "reject" | "paid";

type Props = { refund: Refund; action: RefundAction; onClose: () => void };

export function RefundSummary({ refund }: { refund: Refund }) {
  return (
    <DetailList
      items={[
        { label: "Pedido", value: refund.requestCode },
        { label: "Valor", value: formatKz(refund.amount) },
        { label: "Cliente", value: refund.clientName },
        { label: "Devolver por", value: PAYMENT_LABELS[refund.method] },
        { label: "Origem", value: REFUND_SOURCE_LABELS[refund.source] },
        { label: "Suportado por", value: refund.chargeProvider ? `Prestador (${refund.providerName ?? "—"})` : "Plataforma" },
        { label: "Pedido por", value: `${refund.requestedBy} · ${formatDateTimeNumeric(refund.requestedAt)}`, wide: true },
        { label: "Motivo", value: refund.reason, wide: true },
      ]}
    />
  );
}

export default function RefundDialog({ refund, action, onClose }: Props) {
  const approve = useApproveRefund();
  const reject = useRejectRefund();
  const paid = useMarkRefundPaid();
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
        title={`Aprovar reembolso ${refund.code}`}
        description="Depois de aprovado, o reembolso fica à espera da devolução ao cliente."
        confirmLabel="Aprovar"
        pending={approve.isPending}
        error={mutationError(approve.error)}
        onConfirm={() => approve.mutateAsync({ id: refund.id }).then(onClose, () => undefined)}
      >
        <RefundSummary refund={refund} />
      </ConfirmDialog>
    );
  }

  if (action === "reject") {
    return (
      <ConfirmDialog
        open
        onOpenChange={close}
        title={`Rejeitar reembolso ${refund.code}`}
        description="O valor volta a ficar disponível para reembolso neste pedido."
        confirmLabel="Rejeitar"
        tone="danger"
        requireReason
        reasonLabel="Motivo da rejeição"
        pending={reject.isPending}
        error={mutationError(reject.error)}
        onConfirm={(reason) => reject.mutateAsync({ id: refund.id, reason }).then(onClose, () => undefined)}
      >
        <RefundSummary refund={refund} />
      </ConfirmDialog>
    );
  }

  const referenceError = touched && reference.trim().length < 3 ? "Indique a referência da devolução." : undefined;
  return (
    <ConfirmDialog
      open
      onOpenChange={close}
      title={`Marcar reembolso ${refund.code} como pago`}
      description={
        refund.chargeProvider
          ? "Confirme a devolução ao cliente. O valor é descontado à carteira do prestador."
          : "Confirme a devolução ao cliente. O valor é descontado à receita da plataforma."
      }
      confirmLabel="Marcar como pago"
      pending={paid.isPending}
      error={mutationError(paid.error)}
      onConfirm={() => {
        setTouched(true);
        if (reference.trim().length < 3) return;
        return paid.mutateAsync({ id: refund.id, reference: reference.trim() }).then(onClose, () => undefined);
      }}
    >
      <RefundSummary refund={refund} />
      <Field label="Referência da devolução" htmlFor="refund-reference" required error={referenceError}>
        <Input
          id="refund-reference"
          value={reference}
          placeholder="Por exemplo: DEV482913"
          aria-invalid={Boolean(referenceError)}
          onChange={(event) => setReference(event.target.value)}
          onBlur={() => setTouched(true)}
          autoFocus
        />
      </Field>
    </ConfirmDialog>
  );
}
