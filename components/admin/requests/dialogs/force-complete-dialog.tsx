"use client";

import ConfirmDialog from "@/components/_common/confirm-dialog";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useForceComplete } from "@/hooks/admin/use-requests";
import { STATUS_LABELS, stepsUntil } from "@/lib/leva-ja/status";
import type { ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; open: boolean; onOpenChange: (open: boolean) => void };

export default function ForceCompleteDialog({ request, open, onOpenChange }: Props) {
  const mutation = useForceComplete();
  const steps = stepsUntil(request.status, "rated");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) mutation.reset();
      }}
      title={`Forçar a conclusão de ${request.code}`}
      description={
        <div className="flex flex-col gap-2">
          <span>O pedido avança um estado de cada vez, sem saltar nenhum, e a disputa é fechada com a resolução que indicar.</span>
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Estados que vão ser registados">
            {steps.map((status, index) => (
              <li key={status} className="caption-style text-soft flex items-center gap-1.5">
                {index > 0 && <span aria-hidden>→</span>}
                {STATUS_LABELS[status]}
              </li>
            ))}
          </ol>
        </div>
      }
      confirmLabel="Forçar conclusão"
      requireReason
      reasonLabel="Resolução da disputa"
      reasonPlaceholder="Por exemplo: o comprovativo de entrega confirma o serviço."
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: request.id, reason }).then(() => onOpenChange(false), () => undefined)}
    />
  );
}
