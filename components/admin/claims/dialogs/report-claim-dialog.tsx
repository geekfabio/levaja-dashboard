"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Textarea } from "@/components/_ui/textarea";
import { isRepositoryError } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useReportClaim } from "@/hooks/admin/use-operations";
import { nowLuandaLocal, parseKz } from "@/lib/format";
import { CLAIM_KIND_LABELS } from "@/lib/leva-ja/scheduling";
import type { ClaimKind, ServiceRequest } from "@/types/leva-ja";

export default function ReportClaimDialog({ request, open, onOpenChange }: { request: ServiceRequest; open: boolean; onOpenChange: (open: boolean) => void }) {
  const report = useReportClaim();
  const [kind, setKind] = useState<ClaimKind>("cargo_damage");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => nowLuandaLocal());
  const issues = isRepositoryError(report.error) ? report.error.issues : [];
  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          report.reset();
          setDescription("");
          setAmount("");
        }
      }}
      title={`Participar sinistro do pedido ${request.code}`}
      description="Danos, acidentes ou extravios durante o serviço. A participação segue para análise e decisão das Finanças."
      confirmLabel="Participar"
      pending={report.isPending}
      error={issues.length ? null : mutationError(report.error)}
      onConfirm={() =>
        report
          .mutateAsync({
            requestId: request.id,
            kind,
            description,
            estimatedAmount: parseKz(amount),
            occurredAt: occurredAt ? new Date(`${occurredAt}:00+01:00`).toISOString() : "",
          })
          .then(() => onOpenChange(false), () => undefined)
      }
    >
      <Field label="Tipo" htmlFor="claim-kind">
        <Select value={kind} onValueChange={(value) => setKind(value as ClaimKind)}>
          <SelectTrigger id="claim-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CLAIM_KIND_LABELS) as ClaimKind[]).map((key) => (
              <SelectItem key={key} value={key}>
                {CLAIM_KIND_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="O que aconteceu" htmlFor="claim-description" required error={issueFor("description")}>
        <Textarea id="claim-description" rows={3} value={description} aria-invalid={Boolean(issueFor("description"))} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="Prejuízo estimado (Kz)" htmlFor="claim-amount" required error={issueFor("estimatedAmount")}>
        <Input id="claim-amount" inputMode="numeric" value={amount} aria-invalid={Boolean(issueFor("estimatedAmount"))} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
      </Field>
      <Field label="Quando aconteceu (Luanda)" htmlFor="claim-occurred" required error={issueFor("occurredAt")}>
        <Input id="claim-occurred" type="datetime-local" value={occurredAt} aria-invalid={Boolean(issueFor("occurredAt"))} onChange={(event) => setOccurredAt(event.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}
