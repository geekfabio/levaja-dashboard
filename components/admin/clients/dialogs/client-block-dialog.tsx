"use client";

import ConfirmDialog from "@/components/_common/confirm-dialog";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useClientBlock } from "@/hooks/admin/use-clients";
import type { ClientAccount } from "@/types/leva-ja";

type Props = { client: ClientAccount; open: boolean; onOpenChange: (open: boolean) => void };

export default function ClientBlockDialog({ client, open, onOpenChange }: Props) {
  const blocking = !client.blocked;
  const mutation = useClientBlock(blocking);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) mutation.reset();
      }}
      title={blocking ? `Bloquear ${client.name}?` : `Desbloquear ${client.name}?`}
      description={
        blocking
          ? "O cliente deixa de poder criar pedidos na app até ser desbloqueado. Os pedidos em curso não são afectados."
          : "O cliente volta a poder criar pedidos na app."
      }
      confirmLabel={blocking ? "Bloquear" : "Desbloquear"}
      tone={blocking ? "danger" : "primary"}
      requireReason
      reasonLabel={blocking ? "Motivo do bloqueio" : "Motivo do desbloqueio"}
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: client.id, reason }).then(() => onOpenChange(false), () => undefined)}
    />
  );
}
