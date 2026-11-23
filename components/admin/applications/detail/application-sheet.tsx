"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Skeleton from "@/components/_ui/skeleton";
import DetailList from "@/components/admin/shared/detail-list";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useApplication, useApproveApplication, useRejectApplication } from "@/hooks/admin/use-network";
import { formatDateTimeNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_TONES,
  isApplicationOpen,
} from "@/lib/leva-ja/quality";
import { SERVICE_SHORT_LABELS, VEHICLE_CLASS_LABELS } from "@/lib/leva-ja/services";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import type { ProviderApplication, Zone } from "@/types/leva-ja";

type Props = { applicationId: string | null; onClose: () => void; zones: Zone[]; fleets: { id: string; name: string }[] };

function Body({ application, zones, fleets }: { application: ProviderApplication; zones: Zone[]; fleets: Props["fleets"] }) {
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const open = isApplicationOpen(application.stage);
  const zone = zones.find((item) => item.id === application.zoneId)?.name ?? "—";
  const fleet = fleets.find((item) => item.id === application.fleetId)?.name;

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
        </div>
      </ScrollArea>

      {open && (
        <div className="border-line-strong flex flex-wrap items-center justify-between gap-2 border-t p-4">
          <Button variant="ghost" size="md" onClick={() => setDialog("reject")}>
            Recusar
          </Button>
          <Button variant="primary" size="md" onClick={() => setDialog("approve")}>
            Aprovar e criar prestador
          </Button>
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
