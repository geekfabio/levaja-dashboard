"use client";

import ConfirmDialog from "@/components/_common/confirm-dialog";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useProviderStatus } from "@/hooks/admin/use-providers";
import type { ProviderAccount } from "@/types/leva-ja";

export type ProviderStatusAction = "approve" | "suspend" | "reactivate";

const COPY: Record<ProviderStatusAction, { title: string; description: string; confirm: string; reason: string; tone: "primary" | "danger" }> = {
  approve: {
    title: "Aprovar prestador",
    description: "O prestador passa a activo e pode começar a receber pedidos quando estiver online.",
    confirm: "Aprovar",
    reason: "Nota da aprovação",
    tone: "primary",
  },
  suspend: {
    title: "Suspender prestador",
    description: "O prestador fica offline e deixa de receber pedidos até ser reactivado.",
    confirm: "Suspender",
    reason: "Motivo da suspensão",
    tone: "danger",
  },
  reactivate: {
    title: "Reactivar prestador",
    description: "O prestador volta a poder receber pedidos se tiver os documentos válidos.",
    confirm: "Reactivar",
    reason: "Motivo da reactivação",
    tone: "primary",
  },
};

type Props = { provider: ProviderAccount; action: ProviderStatusAction; open: boolean; onOpenChange: (open: boolean) => void };

export default function ProviderStatusDialog({ provider, action, open, onOpenChange }: Props) {
  const mutation = useProviderStatus(action);
  const copy = COPY[action];
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) mutation.reset();
      }}
      title={`${copy.title}: ${provider.name}`}
      description={copy.description}
      confirmLabel={copy.confirm}
      tone={copy.tone}
      requireReason
      reasonLabel={copy.reason}
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: provider.id, reason }).then(() => onOpenChange(false), () => undefined)}
    />
  );
}
