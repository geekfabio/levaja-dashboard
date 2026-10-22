"use client";

import { useState, type FormEvent } from "react";
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
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import DetailList from "@/components/admin/shared/detail-list";
import { DocumentStateBadge } from "@/components/admin/shared/provider-badges";
import type { DocumentReviewItem } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useApproveDocument, useRejectDocument } from "@/hooks/admin/use-documents";
import { useClock } from "@/hooks/admin/use-clock";
import { formatDateNumeric, formatDateTimeNumeric, luandaDay, shiftDay } from "@/lib/format";

type Props = {
  item: DocumentReviewItem | null;
  onOpenChange: (open: boolean) => void;
};

type Mode = "approve" | "reject";

function ReviewForm({ item, onDone }: { item: DocumentReviewItem; onDone: () => void }) {
  const now = useClock();
  const today = luandaDay(new Date(now || Date.parse(item.submittedAt)));
  const suggested = item.document.validUntil > today ? item.document.validUntil : shiftDay(today, 365);
  const [mode, setMode] = useState<Mode>("approve");
  const [validUntil, setValidUntil] = useState(suggested);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const approve = useApproveDocument();
  const reject = useRejectDocument();
  const pending = approve.isPending || reject.isPending;
  const dateError = touched && mode === "approve" && !(validUntil > today) ? "A validade tem de ser uma data futura." : undefined;
  const reasonError = touched && mode === "reject" && reason.trim().length < 3 ? "Indique o motivo da recusa." : undefined;
  const error = mutationError(mode === "approve" ? approve.error : reject.error);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (mode === "approve") {
      if (!(validUntil > today)) return;
      await approve.mutateAsync({ id: item.document.id, validUntil }).then(onDone, () => undefined);
    } else {
      if (reason.trim().length < 3) return;
      await reject.mutateAsync({ id: item.document.id, reason: reason.trim() }).then(onDone, () => undefined);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="pr-12">
        <DialogTitle>{item.document.title}</DialogTitle>
        <DialogDescription>
          {item.providerName} · {item.vehiclePlate}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-5 px-6 py-5">
        <div
          role="img"
          aria-label={`Pré-visualização simulada do documento ${item.document.title} de ${item.providerName}`}
          className="border-line-strong bg-muted relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-lg border p-4"
        >
          <span className="eyebrow-style text-faint">República de Angola</span>
          <span className="flex flex-col gap-1">
            <span className="lead-style font-medium">{item.document.title}</span>
            <span className="caption-style text-soft">{item.providerName}</span>
          </span>
          <span className="flex items-end justify-between gap-3">
            <span className="flex flex-col gap-1.5">
              <span className="bg-line-strong block h-1.5 w-40 rounded-full" />
              <span className="bg-line-strong block h-1.5 w-28 rounded-full" />
            </span>
            <span className="caption-style text-subtle">Válido até {formatDateNumeric(item.document.validUntil)}</span>
          </span>
          <span className="caption-style text-subtle bg-card absolute top-3 right-3 rounded-full px-2 py-1">Pré-visualização simulada</span>
        </div>
        <DetailList
          items={[
            { label: "Estado", value: <DocumentStateBadge state={item.document.state} /> },
            { label: "Enviado em", value: formatDateTimeNumeric(item.submittedAt) },
            { label: "Validade indicada", value: formatDateNumeric(item.document.validUntil) },
            { label: "Matrícula", value: item.vehiclePlate },
          ]}
        />
        <div role="radiogroup" aria-label="Decisão" className="bg-muted flex self-start rounded-full p-0.5">
          {(["approve", "reject"] as const).map((option) => (
            <Button
              key={option}
              variant="ghost"
              size="sm"
              role="radio"
              aria-checked={mode === option}
              onClick={() => {
                setMode(option);
                setTouched(false);
              }}
              className="aria-checked:bg-secondary aria-checked:text-foreground px-3"
            >
              {option === "approve" ? "Aprovar" : "Recusar"}
            </Button>
          ))}
        </div>
        {mode === "approve" ? (
          <Field label="Válido até" htmlFor="document-valid-until" required error={dateError} hint="Confirme a data de validade impressa no documento.">
            <Input
              id="document-valid-until"
              type="date"
              value={validUntil}
              min={shiftDay(today, 1)}
              aria-invalid={Boolean(dateError)}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </Field>
        ) : (
          <Field label="Motivo da recusa" htmlFor="document-reason" required error={reasonError} hint="O prestador recebe este motivo e tem de enviar o documento de novo.">
            <Textarea
              id="document-reason"
              rows={3}
              value={reason}
              placeholder="Por exemplo: a fotografia está desfocada e não se lê o número."
              aria-invalid={Boolean(reasonError)}
              onChange={(event) => setReason(event.target.value)}
              autoFocus
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="caption-style text-danger">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" size="md" onClick={onDone} disabled={pending}>
          Fechar
        </Button>
        <Button type="submit" variant={mode === "approve" ? "primary" : "danger"} size="md" disabled={pending}>
          {pending ? "A guardar…" : mode === "approve" ? "Aprovar documento" : "Recusar documento"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ReviewDocumentDialog({ item, onOpenChange }: Props) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        {item && <ReviewForm key={item.document.id} item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
