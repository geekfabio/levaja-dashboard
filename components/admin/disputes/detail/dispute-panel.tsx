"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Textarea } from "@/components/_ui/textarea";
import DetailList from "@/components/admin/shared/detail-list";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useAddDisputeNote, useSetDisputeCategory } from "@/hooks/admin/use-disputes";
import { useClock } from "@/hooks/admin/use-clock";
import { formatDateTimeNumeric, formatElapsed, formatKz } from "@/lib/format";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_TARGET_HOURS,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_TONES,
  isDisputeOverdue,
} from "@/lib/leva-ja/refunds";
import type { Dispute, DisputeCategory, Refund, ServiceRequest } from "@/types/leva-ja";

export function disputeBadge(dispute: Dispute, now: number) {
  if (dispute.resolvedAt) return { tone: "success" as const, label: dispute.outcome ? `Resolvida · ${DISPUTE_OUTCOME_LABELS[dispute.outcome]}` : "Resolvida" };
  if (isDisputeOverdue(dispute, now)) return { tone: "danger" as const, label: "Fora do prazo" };
  return { tone: "warning" as const, label: "Aberta" };
}

type Props = {
  request: ServiceRequest & { dispute: Dispute };
  refunds: Refund[];
  refundable: number | null;
  canEdit: boolean;
};

export default function DisputePanel({ request, refunds, refundable, canEdit }: Props) {
  const now = useClock();
  const addNote = useAddDisputeNote();
  const setCategory = useSetDisputeCategory();
  const [note, setNote] = useState("");
  const dispute = request.dispute;
  const open = !dispute.resolvedAt;
  const badge = disputeBadge(dispute, now);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={badge.tone} label={badge.label} />
        {open && <span className="caption-style text-subtle">Aberta há {formatElapsed(dispute.openedAt, now)} · prazo de {DISPUTE_TARGET_HOURS} h</span>}
      </div>

      <DetailList
        items={[
          { label: "Motivo", value: dispute.reason, wide: true },
          { label: "Aberta por", value: `${dispute.openedBy} · ${formatDateTimeNumeric(dispute.openedAt)}`, wide: true },
          { label: "Cliente", value: request.client?.name ?? "—" },
          { label: "Prestador", value: request.provider?.name ?? "—" },
          { label: "Pago pelo cliente", value: formatKz(request.price.total) },
          { label: "Por reembolsar", value: refundable === null ? "—" : formatKz(refundable) },
        ]}
      />

      {open && canEdit ? (
        <Field label="Categoria" htmlFor={`dispute-category-${request.id}`}>
          <Select
            value={dispute.category ?? "other"}
            onValueChange={(category) => setCategory.mutate({ requestId: request.id, category: category as DisputeCategory })}
            disabled={setCategory.isPending}
          >
            <SelectTrigger id={`dispute-category-${request.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISPUTE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {DISPUTE_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <DetailList items={[{ label: "Categoria", value: DISPUTE_CATEGORY_LABELS[dispute.category ?? "other"] }]} />
      )}

      <section aria-label="Notas da disputa" className="flex flex-col gap-3">
        <h3 className="eyebrow-style text-faint font-normal">Notas internas</h3>
        {dispute.notes?.length ? (
          <ol className="flex flex-col gap-2">
            {dispute.notes.map((item) => (
              <li key={item.id} className="bg-muted flex flex-col gap-1 rounded-xl px-4 py-3">
                <span className="caption-style text-soft">
                  {item.author} · {formatDateTimeNumeric(item.at)}
                </span>
                <p className="p-style">{item.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="caption-style text-subtle">Ainda sem notas.</p>
        )}
        {open && canEdit && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (note.trim().length < 3) return;
              addNote.mutateAsync({ requestId: request.id, text: note.trim() }).then(() => setNote(""), () => undefined);
            }}
          >
            <Field label="Nova nota" htmlFor={`dispute-note-${request.id}`} error={addNote.error ? (mutationError(addNote.error) ?? undefined) : undefined}>
              <Textarea id={`dispute-note-${request.id}`} rows={3} value={note} placeholder="O que foi apurado, quem foi contactado, que provas existem." onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" size="sm" className="self-end" disabled={addNote.isPending || note.trim().length < 3}>
              {addNote.isPending ? "A guardar…" : "Acrescentar nota"}
            </Button>
          </form>
        )}
      </section>

      <section aria-label="Reembolsos do pedido" className="flex flex-col gap-2">
        <h3 className="eyebrow-style text-faint font-normal">Reembolsos</h3>
        {refunds.length ? (
          <ul className="divide-border flex flex-col divide-y">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="lead-style tabular-nums">
                    {refund.code} · {formatKz(refund.amount)}
                  </span>
                  <span className="caption-style text-subtle truncate">{refund.reason}</span>
                </span>
                <ToneBadge tone={REFUND_STATUS_TONES[refund.status]} label={REFUND_STATUS_LABELS[refund.status]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="caption-style text-subtle">Sem reembolsos neste pedido.</p>
        )}
      </section>

      {dispute.resolvedAt && (
        <div className="flex flex-col gap-1 rounded-xl border border-(--tag-green-border) bg-(--tag-green-bg) p-4 text-(--tag-green-text)">
          <span className="lead-style font-medium">{dispute.outcome ? DISPUTE_OUTCOME_LABELS[dispute.outcome] : "Resolvida"}</span>
          <span className="caption-style">{dispute.resolution}</span>
          <span className="caption-style">
            {dispute.resolvedBy ? `${dispute.resolvedBy} · ` : ""}
            {formatDateTimeNumeric(dispute.resolvedAt)}
          </span>
        </div>
      )}
    </div>
  );
}
