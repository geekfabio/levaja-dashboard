"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Skeleton from "@/components/_ui/skeleton";
import { Textarea } from "@/components/_ui/textarea";
import DetailList from "@/components/admin/shared/detail-list";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useAddClaimNote, useApproveClaim, useClaim, useMarkClaimPaid, useRejectClaim, useStartClaimReview } from "@/hooks/admin/use-operations";
import { formatDateTimeNumeric, formatKz, formatNumber, parseKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { CLAIM_KIND_LABELS, CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from "@/lib/leva-ja/scheduling";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import type { Claim } from "@/types/leva-ja";

type Dialog = "review" | "approve" | "reject" | "paid" | null;

function Body({ claim, canManage, canOpenRequest }: { claim: Claim; canManage: boolean; canOpenRequest: boolean }) {
  const review = useStartClaimReview();
  const note = useAddClaimNote();
  const approve = useApproveClaim();
  const reject = useRejectClaim();
  const paid = useMarkClaimPaid();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [insurer, setInsurer] = useState("");
  const [policy, setPolicy] = useState("");
  const [amount, setAmount] = useState(String(claim.estimatedAmount));
  const [reference, setReference] = useState("");
  const open = claim.status === "reported" || claim.status === "under_review";
  const close = (next: boolean) => {
    if (!next) {
      setDialog(null);
      [review, approve, reject, paid].forEach((mutation) => mutation.reset());
    }
  };
  const amountValue = parseKz(amount);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={CLAIM_STATUS_TONES[claim.status]} label={CLAIM_STATUS_LABELS[claim.status]} />
            <span className="caption-style text-subtle">{CLAIM_KIND_LABELS[claim.kind]}</span>
          </div>
          <p className="p-style">{claim.description}</p>
          <DetailList
            items={[
              {
                label: "Pedido",
                value: canOpenRequest ? (
                  <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${claim.requestId}`}>
                    {claim.requestCode}
                  </Button>
                ) : (
                  claim.requestCode
                ),
              },
              { label: "Prejuízo estimado", value: formatKz(claim.estimatedAmount) },
              { label: "Cliente", value: claim.clientName },
              { label: "Prestador", value: claim.providerName ?? "—" },
              { label: "Aconteceu", value: formatDateTimeNumeric(claim.occurredAt) },
              { label: "Participado", value: `${claim.reportedBy} · ${formatDateTimeNumeric(claim.reportedAt)}` },
              { label: "Seguradora", value: claim.insurer ? `${claim.insurer} · ${claim.policyNumber}` : "—", wide: true },
              { label: "Fotografias do dano", value: claim.photoIds.length ? `${formatNumber(claim.photoIds.length)} no pedido` : "Nenhuma" },
              ...(claim.approvedAmount ? [{ label: "Indemnização", value: formatKz(claim.approvedAmount) }] : []),
              ...(claim.decisionReason ? [{ label: "Decisão", value: `${claim.decisionReason} (${claim.decidedBy ?? ""})`, wide: true }] : []),
              ...(claim.paymentReference ? [{ label: "Pagamento", value: `Ref. ${claim.paymentReference}` }] : []),
            ]}
          />
          <section aria-label="Notas do sinistro" className="flex flex-col gap-2">
            <h3 className="eyebrow-style text-faint font-normal">Notas</h3>
            {claim.notes.length ? (
              <ol className="flex flex-col gap-2">
                {claim.notes.map((item) => (
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
            {open && (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (text.trim().length >= 3) note.mutateAsync({ id: claim.id, text: text.trim() }).then(() => setText(""), () => undefined);
                }}
              >
                <Field label="Nova nota" htmlFor={`claim-note-${claim.id}`} error={note.error ? (mutationError(note.error) ?? undefined) : undefined}>
                  <Textarea id={`claim-note-${claim.id}`} rows={2} value={text} onChange={(event) => setText(event.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" size="sm" className="self-end" disabled={text.trim().length < 3 || note.isPending}>
                  Acrescentar nota
                </Button>
              </form>
            )}
          </section>
        </div>
      </ScrollArea>
      {canManage && claim.status !== "rejected" && claim.status !== "paid" && (
        <div className="border-line-strong flex flex-wrap items-center justify-end gap-2 border-t p-4">
          {open && (
            <Button variant="ghost" size="md" onClick={() => setDialog("reject")}>
              Recusar
            </Button>
          )}
          {claim.status === "reported" && (
            <Button variant="primary" size="md" onClick={() => setDialog("review")}>
              Enviar para análise
            </Button>
          )}
          {claim.status === "under_review" && (
            <Button variant="primary" size="md" onClick={() => setDialog("approve")}>
              Aprovar indemnização
            </Button>
          )}
          {claim.status === "approved" && (
            <Button variant="primary" size="md" onClick={() => setDialog("paid")}>
              Registar pagamento
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={dialog === "review"}
        onOpenChange={close}
        title={`Enviar ${claim.code} para análise`}
        description="Indique a seguradora e a apólice que cobrem o serviço."
        confirmLabel="Enviar"
        canConfirm={insurer.trim().length >= 3 && policy.trim().length >= 3}
        pending={review.isPending}
        error={mutationError(review.error)}
        onConfirm={() => review.mutateAsync({ id: claim.id, insurer: insurer.trim(), policyNumber: policy.trim() }).then(() => setDialog(null), () => undefined)}
      >
        <Field label="Seguradora" htmlFor="claim-insurer" required>
          <Input id="claim-insurer" value={insurer} placeholder="Por exemplo: Kianda Seguros" onChange={(event) => setInsurer(event.target.value)} />
        </Field>
        <Field label="Número da apólice" htmlFor="claim-policy" required>
          <Input id="claim-policy" value={policy} placeholder="AP-2026-000123" onChange={(event) => setPolicy(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={close}
        title={`Aprovar ${claim.code}`}
        description={`Prejuízo estimado: ${formatKz(claim.estimatedAmount)}. A indemnização não pode passar 150 % do estimado.`}
        confirmLabel="Aprovar"
        requireReason
        reasonLabel="Justificação"
        canConfirm={Number.isInteger(amountValue) && amountValue > 0}
        pending={approve.isPending}
        error={mutationError(approve.error)}
        onConfirm={(reason) => approve.mutateAsync({ id: claim.id, amount: amountValue, reason }).then(() => setDialog(null), () => undefined)}
      >
        <Field label="Indemnização (Kz)" htmlFor="claim-approve-amount" required>
          <Input id="claim-approve-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className="tabular-nums" />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={close}
        title={`Recusar ${claim.code}`}
        confirmLabel="Recusar"
        tone="danger"
        requireReason
        reasonLabel="Motivo da recusa"
        pending={reject.isPending}
        error={mutationError(reject.error)}
        onConfirm={(reason) => reject.mutateAsync({ id: claim.id, reason }).then(() => setDialog(null), () => undefined)}
      />
      <ConfirmDialog
        open={dialog === "paid"}
        onOpenChange={close}
        title={`Registar pagamento de ${claim.code}`}
        description={`Indemnização de ${formatKz(claim.approvedAmount ?? 0)} ao cliente.`}
        confirmLabel="Registar"
        canConfirm={reference.trim().length >= 3}
        pending={paid.isPending}
        error={mutationError(paid.error)}
        onConfirm={() => paid.mutateAsync({ id: claim.id, reference: reference.trim() }).then(() => setDialog(null), () => undefined)}
      >
        <Field label="Referência do pagamento" htmlFor="claim-reference" required>
          <Input id="claim-reference" value={reference} placeholder="IND700123" onChange={(event) => setReference(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

export default function ClaimSheet({ claimId, onClose, canManage, canOpenRequest }: { claimId: string | null; onClose: () => void; canManage: boolean; canOpenRequest: boolean }) {
  const query = useClaim(claimId);
  return (
    <Sheet open={claimId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{query.data ? `${query.data.code} · ${query.data.requestCode}` : "Sinistro"}</SheetTitle>
            <SheetDescription className="sr-only">Detalhe do sinistro, notas e decisão.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) => <Body key={`${data.id}-${data.status}`} claim={data} canManage={canManage} canOpenRequest={canOpenRequest} />}
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
