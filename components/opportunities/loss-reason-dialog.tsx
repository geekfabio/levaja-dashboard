"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { LOSS_REASONS, type LossReason } from "@/data/opportunities";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import { useMoveStage, useOpportunity } from "@/hooks/crm/use-opportunities";

export default function LossReasonDialog() {
  const pendingLossMove = useOpportunitiesStore((state) => state.pendingLossMove);
  const cancelLossMove = useOpportunitiesStore((state) => state.cancelLossMove);
  const moveStage = useMoveStage();
  const { data: opportunity } = useOpportunity(pendingLossMove?.id ?? null);
  const [reason, setReason] = useState<LossReason>(LOSS_REASONS[0]);

  function confirm() {
    if (!opportunity) return;
    moveStage.mutate({ id: opportunity.id, stage: "Fechada - Perdida", previous: opportunity, lossReason: reason });
    cancelLossMove();
  }

  return (
    <Dialog
      open={pendingLossMove !== null}
      onOpenChange={(open) => !open && cancelLossMove()}
    >
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
          <DialogDescription>
            Obrigatório antes de marcar a oportunidade como perdida.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <Field label="Motivo" htmlFor="loss-reason">
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as LossReason)}
            >
              <SelectTrigger id="loss-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="subtle" size="sm" onClick={cancelLossMove}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={confirm}
          >
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
