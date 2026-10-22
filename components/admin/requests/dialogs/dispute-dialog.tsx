"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useOpenDispute } from "@/hooks/admin/use-requests";
import { DISPUTE_CATEGORIES, DISPUTE_CATEGORY_LABELS } from "@/lib/leva-ja/refunds";
import type { DisputeCategory, ServiceRequest } from "@/types/leva-ja";

type Props = { request: ServiceRequest; open: boolean; onOpenChange: (open: boolean) => void };

export default function DisputeDialog({ request, open, onOpenChange }: Props) {
  const mutation = useOpenDispute();
  const [category, setCategory] = useState<DisputeCategory>("other");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          mutation.reset();
          setCategory("other");
        }
      }}
      title={`Abrir disputa no pedido ${request.code}`}
      description="A disputa fica visível para a equipa e bloqueia o avanço automático do pedido até ser resolvida."
      confirmLabel="Abrir disputa"
      requireReason
      reasonLabel="Motivo da disputa"
      reasonPlaceholder="Por exemplo: o cliente alega que a carga chegou danificada."
      pending={mutation.isPending}
      error={mutationError(mutation.error)}
      onConfirm={(reason) => mutation.mutateAsync({ id: request.id, reason, category }).then(() => onOpenChange(false), () => undefined)}
    >
      <Field label="Categoria" htmlFor="dispute-category">
        <Select value={category} onValueChange={(next) => setCategory(next as DisputeCategory)}>
          <SelectTrigger id="dispute-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISPUTE_CATEGORIES.map((key) => (
              <SelectItem key={key} value={key}>
                {DISPUTE_CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </ConfirmDialog>
  );
}
