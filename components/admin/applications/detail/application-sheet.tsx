"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
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
import { useClock } from "@/hooks/admin/use-clock";
import {
  useAdvanceApplication,
  useApplication,
  useApproveApplication,
  useRecordInspection,
  useReceiveApplicationDocument,
  useRejectApplication,
  useScheduleInterview,
} from "@/hooks/admin/use-network";
import { formatDateTimeNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_TONES,
  REQUIRED_APPLICATION_DOCUMENTS,
  applicationBlocker,
  isApplicationOpen,
  nextApplicationStage,
} from "@/lib/leva-ja/quality";
import { DOCUMENT_TITLES, SERVICE_SHORT_LABELS, VEHICLE_CLASS_LABELS } from "@/lib/leva-ja/services";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import type { ProviderApplication, Zone } from "@/types/leva-ja";

type Props = { applicationId: string | null; onClose: () => void; zones: Zone[]; fleets: { id: string; name: string }[] };

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const date = new Date(new Date(iso).getTime() + 60 * 60_000);
  return date.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00+01:00`).toISOString() : "";
}

function Body({ application, zones, fleets }: { application: ProviderApplication; zones: Zone[]; fleets: Props["fleets"] }) {
  const now = useClock();
  const receive = useReceiveApplicationDocument();
  const schedule = useScheduleInterview();
  const inspect = useRecordInspection();
  const advance = useAdvanceApplication();
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const [interviewAt, setInterviewAt] = useState(toLocalInput(application.interviewAt));
  const [passed, setPassed] = useState(true);
  const [notes, setNotes] = useState("");
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const open = isApplicationOpen(application.stage);
  const next = nextApplicationStage(application.stage);
  const blocker = applicationBlocker(application, now);
  const zone = zones.find((item) => item.id === application.zoneId)?.name ?? "—";
  const fleet = fleets.find((item) => item.id === application.fleetId)?.name;
  const errors = [receive.error, schedule.error, inspect.error, advance.error].map(mutationError).filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={APPLICATION_STAGE_TONES[application.stage]} label={APPLICATION_STAGE_LABELS[application.stage]} />
            <span className="caption-style text-subtle">Recebida a {formatDateTimeNumeric(application.submittedAt)} · {APPLICATION_SOURCE_LABELS[application.source]}</span>
          </div>
          <DetailList
            items={[
              { label: "Telefone", value: <span className="tabular-nums">{application.phone}</span> },
              { label: "E-mail", value: application.email },
              { label: "Viatura", value: `${application.vehicleLabel} · ${VEHICLE_CLASS_LABELS[application.vehicleClass]}` },
              { label: "Matrícula", value: application.plate },
              { label: "Zona", value: zone },
              { label: "Frota", value: fleet ?? "Independente" },
              { label: "Serviços", value: application.services.map((service) => SERVICE_SHORT_LABELS[service]).join(", "), wide: true },
            ]}
          />

          <section aria-label="Documentos" className="flex flex-col gap-2">
            <h3 className="eyebrow-style text-faint font-normal">Documentos</h3>
            <ul className="flex flex-col gap-2">
              {REQUIRED_APPLICATION_DOCUMENTS.map((icon) => {
                const received = application.documentsReceived.includes(icon);
                const canReceive = open && !received && (application.stage === "submitted" || application.stage === "documents");
                return (
                  <li key={icon} className="flex items-center justify-between gap-3">
                    <span className="lead-style">{DOCUMENT_TITLES[icon]}</span>
                    {received ? (
                      <ToneBadge tone="success" label="Recebido" />
                    ) : canReceive ? (
                      <Button variant="secondary" size="sm" disabled={receive.isPending} onClick={() => receive.mutate({ id: application.id, icon })}>
                        Marcar como recebido
                      </Button>
                    ) : (
                      <ToneBadge tone="neutral" label="Em falta" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {(application.stage === "interview" || application.interviewAt) && (
            <section aria-label="Entrevista" className="flex flex-col gap-2">
              <h3 className="eyebrow-style text-faint font-normal">Entrevista</h3>
              {application.stage === "interview" ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (interviewAt) schedule.mutate({ id: application.id, at: fromLocalInput(interviewAt) });
                  }}
                >
                  <Field label="Data e hora (Luanda)" htmlFor="interview-at" className="min-w-[220px] flex-1">
                    <Input id="interview-at" type="datetime-local" value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)} />
                  </Field>
                  <Button type="submit" variant="secondary" size="md" disabled={!interviewAt || schedule.isPending}>
                    {application.interviewAt ? "Remarcar" : "Marcar"}
                  </Button>
                </form>
              ) : (
                <p className="caption-style text-soft">{application.interviewAt ? formatDateTimeNumeric(application.interviewAt) : "—"}</p>
              )}
            </section>
          )}

          {application.stage === "inspection" && !application.inspection?.passed && (
            <section aria-label="Vistoria" className="flex flex-col gap-2">
              <h3 className="eyebrow-style text-faint font-normal">Vistoria da viatura</h3>
              {application.inspection && <p className="caption-style text-danger">Última vistoria reprovada: {application.inspection.notes}</p>}
              <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
                <Checkbox checked={passed} onCheckedChange={(value) => setPassed(value === true)} />
                Viatura aprovada na vistoria
              </label>
              <Field label="Notas da vistoria" htmlFor="inspection-notes">
                <Textarea id="inspection-notes" rows={2} value={notes} placeholder="Estado dos pneus, travões, luzes, carroçaria." onChange={(event) => setNotes(event.target.value)} />
              </Field>
              <Button
                variant="secondary"
                size="sm"
                className="self-end"
                disabled={notes.trim().length < 3 || inspect.isPending}
                onClick={() => inspect.mutateAsync({ id: application.id, passed, notes: notes.trim() }).then(() => setNotes(""), () => undefined)}
              >
                Registar vistoria
              </Button>
            </section>
          )}
          {application.inspection?.passed && (
            <DetailList items={[{ label: "Vistoria", value: `Aprovada · ${application.inspection.notes}`, wide: true }]} />
          )}

          <section aria-label="Histórico" className="flex flex-col gap-2">
            <h3 className="eyebrow-style text-faint font-normal">Histórico</h3>
            <ol className="flex flex-col gap-2">
              {application.history.map((event, index) => (
                <li key={`${event.stage}-${index}`} className="caption-style flex flex-col">
                  <span className="lead-style">{APPLICATION_STAGE_LABELS[event.stage]}</span>
                  <span className="text-subtle">
                    {formatDateTimeNumeric(event.at)} · {event.by}
                    {event.note ? ` · ${event.note}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {application.stage === "rejected" && application.rejectionReason && (
            <div className="flex flex-col gap-1 rounded-xl border border-(--tag-red-border) bg-(--tag-red-bg) p-4 text-(--tag-red-text)">
              <span className="lead-style font-medium">Recusada</span>
              <span className="caption-style">{application.rejectionReason}</span>
            </div>
          )}
          {application.providerId && (
            <Button variant="secondary" size="sm" href={`${SECTION_ROUTES.providers}/${application.providerId}`} className="self-start">
              Abrir prestador criado
            </Button>
          )}
          {errors.length > 0 && (
            <p role="alert" className="caption-style text-danger">
              {errors[0]}
            </p>
          )}
        </div>
      </ScrollArea>

      {open && (
        <div className="border-line-strong flex flex-wrap items-center justify-between gap-2 border-t p-4">
          <Button variant="ghost" size="md" onClick={() => setDialog("reject")}>
            Recusar
          </Button>
          <span className="flex flex-wrap items-center gap-2">
            {blocker && <span className="caption-style text-subtle">{blocker}</span>}
            {next ? (
              <Button variant="primary" size="md" disabled={Boolean(blocker) || advance.isPending} onClick={() => advance.mutate({ id: application.id })}>
                Avançar para {APPLICATION_STAGE_LABELS[next].toLowerCase()}
              </Button>
            ) : (
              <Button variant="primary" size="md" disabled={Boolean(blocker)} onClick={() => setDialog("approve")}>
                Aprovar e criar prestador
              </Button>
            )}
          </span>
        </div>
      )}

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(value) => {
          if (!value) {
            setDialog(null);
            approve.reset();
          }
        }}
        title={`Aprovar ${application.code}`}
        description="É criado o prestador com os documentos por validar. Fica activo depois da validação em Documentos."
        confirmLabel="Aprovar"
        requireReason
        reasonLabel="Nota da aprovação"
        pending={approve.isPending}
        error={mutationError(approve.error)}
        onConfirm={(reason) => approve.mutateAsync({ id: application.id, reason }).then(() => setDialog(null), () => undefined)}
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(value) => {
          if (!value) {
            setDialog(null);
            reject.reset();
          }
        }}
        title={`Recusar ${application.code}`}
        description="O candidato é informado do motivo pela app."
        confirmLabel="Recusar"
        tone="danger"
        requireReason
        reasonLabel="Motivo da recusa"
        pending={reject.isPending}
        error={mutationError(reject.error)}
        onConfirm={(reason) => reject.mutateAsync({ id: application.id, reason }).then(() => setDialog(null), () => undefined)}
      />
    </div>
  );
}

export default function ApplicationSheet({ applicationId, onClose, zones, fleets }: Props) {
  const query = useApplication(applicationId);
  return (
    <Sheet open={applicationId !== null} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{query.data ? `${query.data.code} · ${query.data.name}` : "Candidatura"}</SheetTitle>
            <SheetDescription className="sr-only">Detalhe da candidatura, documentos, entrevista, vistoria e decisão.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) => <Body key={`${data.id}-${data.stage}`} application={data} zones={zones} fleets={fleets} />}
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
