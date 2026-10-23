"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { usePenalize } from "@/hooks/admin/use-network";
import { parseKz } from "@/lib/format";
import { PENALTY_KIND_LABELS } from "@/lib/leva-ja/quality";
import type { PenaltyKind } from "@/types/leva-ja";

const DESCRIPTIONS: Record<PenaltyKind, string> = {
  warning: "Fica no histórico do prestador e conta para a qualidade.",
  fine: "O valor é descontado à carteira do prestador.",
  suspension: "O prestador fica suspenso e volta a ficar activo no fim do prazo.",
};

export default function PenaltyDialog({ providerId, providerName, open, onOpenChange }: { providerId: string; providerName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const penalize = usePenalize();
  const [kind, setKind] = useState<PenaltyKind>("warning");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("3");
  const amountValue = parseKz(amount);
  const daysValue = Number(days);
  const amountError = kind === "fine" && amount && (!Number.isInteger(amountValue) || amountValue <= 0) ? "Indique o valor da multa." : undefined;
  const daysError = kind === "suspension" && (!Number.isInteger(daysValue) || daysValue < 1 || daysValue > 90) ? "Entre 1 e 90 dias." : undefined;
  const valid = kind === "fine" ? Number.isInteger(amountValue) && amountValue > 0 : kind === "suspension" ? !daysError : true;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          penalize.reset();
          setKind("warning");
          setAmount("");
          setDays("3");
        }
      }}
      title={`Penalizar ${providerName}`}
      description={DESCRIPTIONS[kind]}
      confirmLabel="Aplicar penalização"
      tone={kind === "warning" ? "primary" : "danger"}
      requireReason
      reasonLabel="Motivo"
      canConfirm={valid}
      pending={penalize.isPending}
      error={mutationError(penalize.error)}
      onConfirm={(reason) =>
        penalize
          .mutateAsync({ providerId, input: { kind, reason, amount: kind === "fine" ? amountValue : undefined, days: kind === "suspension" ? daysValue : undefined } })
          .then(() => onOpenChange(false), () => undefined)
      }
    >
      <Field label="Tipo" htmlFor="penalty-kind">
        <Select value={kind} onValueChange={(value) => setKind(value as PenaltyKind)}>
          <SelectTrigger id="penalty-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PENALTY_KIND_LABELS) as PenaltyKind[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PENALTY_KIND_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {kind === "fine" && (
        <Field label="Valor da multa (Kz)" htmlFor="penalty-amount" required error={amountError}>
          <Input id="penalty-amount" inputMode="numeric" value={amount} aria-invalid={Boolean(amountError)} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
        </Field>
      )}
      {kind === "suspension" && (
        <Field label="Duração (dias)" htmlFor="penalty-days" required error={daysError}>
          <Input id="penalty-days" inputMode="numeric" value={days} aria-invalid={Boolean(daysError)} onChange={(event) => setDays(event.target.value)} className="tabular-nums" />
        </Field>
      )}
    </ConfirmDialog>
  );
}
