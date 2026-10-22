"use client";

import ConfirmDialog from "@/components/_common/confirm-dialog";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useOpenDispute } from "@/hooks/admin/use-requests";
import type { ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; open: boolean; onOpenChange: (open: boolean) => void };

export default function DisputeDialog({ request, open, onOpenChange }: Props) {
  const mutation = useOpenDispute();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) mutation.reset();
      }}
      title={`Abrir disputa no pedido ${request.code}`}
      description="A disputa fica visível para a equipa e bloqueia o avanço automático do pedido até ser resolvida."
      confirmLabel="Abrir disputa"
      requireReason
      reasonLabel="Motivo da disputa"
      reasonPlaceholder="Por exemplo: o cliente alega que a carga chegou danificada."
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: request.id, reason }).then(() => onOpenChange(false), () => undefined)}
    />
  );
}
