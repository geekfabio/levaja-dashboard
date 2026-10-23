"use client";

import ConfirmDialog from "@/components/_common/confirm-dialog";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useCancelRequest } from "@/hooks/admin/use-requests";
import { STATUS_LABELS } from "@/lib/leva-ja/status";
import type { ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; open: boolean; onOpenChange: (open: boolean) => void };

export default function CancelDialog({ request, open, onOpenChange }: Props) {
  const mutation = useCancelRequest();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) mutation.reset();
      }}
      title={`Cancelar o pedido ${request.code}?`}
      description={`O pedido está em «${STATUS_LABELS[request.status]}». O cliente e o prestador são avisados e o cancelamento não pode ser anulado.`}
      confirmLabel="Cancelar pedido"
      tone="danger"
      requireReason
      reasonLabel="Motivo do cancelamento"
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: request.id, reason }).then(() => onOpenChange(false), () => undefined)}
    />
  );
}
