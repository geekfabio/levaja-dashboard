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
import { useClock } from "@/hooks/admin/use-clock";
import { useCompletePrivacyRequest, useExportPrivacyData, usePrivacyRequest, useRejectPrivacyRequest, useStartPrivacyRequest } from "@/hooks/admin/use-trust";
import { downloadJson } from "@/lib/csv";
import { formatDateTimeNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { canAccessSection } from "@/lib/leva-ja/permissions";
import { PRIVACY_CHANNEL_LABELS, PRIVACY_KIND_LABELS, PRIVACY_STATUS_LABELS, PRIVACY_STATUS_TONES } from "@/lib/leva-ja/trust";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { PrivacyRequest } from "@/types/leva-ja";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import DeadlineBadge from "./deadline-badge";

type Dialog = "complete" | "reject" | null;

const COMPLETE_HINTS: Record<PrivacyRequest["kind"], string> = {
  access: "Exporte os dados, envie-os ao titular e descreva como foram entregues.",
  portability: "Exporte os dados em formato aberto, envie-os ao titular e descreva como foram entregues.",
  rectification: "Corrija os dados na ficha do titular e descreva o que mudou.",
  erasure: "A conta é anonimizada de imediato: nome, contactos, moradas e métodos de pagamento são apagados. Os pedidos e as facturas ficam, sem dados pessoais. Não é possível desfazer.",
  objection: "Descreva os tratamentos que deixaram de ser feitos (por exemplo, comunicações de marketing).",
};

function Body({ request }: { request: PrivacyRequest }) {
  const now = useClock();
  const role = useAdminSessionStore((state) => state.session?.user.role);
  const start = useStartPrivacyRequest();
  const complete = useCompletePrivacyRequest();
  const reject = useRejectPrivacyRequest();
  const exporter = useExportPrivacyData();
  const [dialog, setDialog] = useState<Dialog>(null);
  const open = request.status === "received" || request.status === "in_progress";
  const exportable = request.kind === "access" || request.kind === "portability";
  const section = request.subjectKind === "client" ? "clients" : "providers";
  const canOpenSubject = role ? canAccessSection(role, section) : false;
  const close = (next: boolean) => {
    if (!next) {
      setDialog(null);
      complete.reset();
      reject.reset();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={PRIVACY_STATUS_TONES[request.status]} label={PRIVACY_STATUS_LABELS[request.status]} />
            <DeadlineBadge request={request} now={now} />
          </div>
          <p className="p-style">{request.details}</p>
          <DetailList
            items={[
              {
                label: request.subjectKind === "client" ? "Cliente" : "Prestador",
                value: canOpenSubject ? (
                  <Button variant="link" size="none" href={`${SECTION_ROUTES[section]}/${request.subjectId}`}>
                    {request.subjectName}
                  </Button>
                ) : (
                  request.subjectName
                ),
              },
              { label: "Tipo", value: PRIVACY_KIND_LABELS[request.kind] },
              {
                label: "Canal",
                value: PRIVACY_CHANNEL_LABELS[request.channel],
              },
              {
                label: "Recebido",
                value: formatDateTimeNumeric(request.receivedAt),
              },
              {
                label: "Prazo de resposta",
                value: formatDateTimeNumeric(request.dueAt),
              },
              {
                label: "Responsável",
                value: request.assigneeName ?? "Por atribuir",
              },
              ...(request.resolution
                ? [
                    {
                      label: request.status === "rejected" ? "Fundamento da recusa" : "O que foi feito",
                      value: request.resolution,
                      wide: true,
                    },
                  ]
                : []),
              ...(request.completedAt
                ? [
                    {
                      label: "Fechado",
                      value: formatDateTimeNumeric(request.completedAt),
                    },
                  ]
                : []),
            ]}
          />
          {exportable && (
            <div className="border-border flex flex-col gap-2 rounded-xl border p-4">
              <span className="lead-style font-medium">Exportação dos dados</span>
              <span className="caption-style text-soft">Ficheiro JSON com o perfil, as moradas, os pedidos e as ocorrências do titular. A exportação fica registada na auditoria.</span>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                disabled={exporter.isPending}
                onClick={() =>
                  exporter.mutateAsync(request.id).then(
                    (result) => downloadJson(`${request.code.toLowerCase()}-dados-pessoais.json`, result),
                    () => undefined,
                  )
                }
              >
                {exporter.isPending ? "A preparar…" : "Descarregar dados (JSON)"}
              </Button>
              {exporter.error ? (
                <span role="alert" className="caption-style text-danger">
                  {mutationError(exporter.error)}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </ScrollArea>
      {open && (
        <div className="border-line-strong flex flex-wrap items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" size="md" onClick={() => setDialog("reject")}>
            Recusar
          </Button>
          {request.status === "received" ? (
            <Button variant="primary" size="md" disabled={start.isPending} onClick={() => start.mutate(request.id)}>
              {start.isPending ? "A iniciar…" : "Iniciar tratamento"}
            </Button>
          ) : (
            <Button variant={request.kind === "erasure" ? "danger" : "primary"} size="md" onClick={() => setDialog("complete")}>
              {request.kind === "erasure" ? "Eliminar dados e concluir" : "Concluir"}
            </Button>
          )}
        </div>
      )}
      {start.error ? (
        <span role="alert" className="caption-style text-danger px-4 pb-4">
          {mutationError(start.error)}
        </span>
      ) : null}
      <ConfirmDialog
        open={dialog === "complete"}
        onOpenChange={close}
        title={request.kind === "erasure" ? `Eliminar os dados de ${request.subjectName}?` : `Concluir ${request.code}`}
        description={COMPLETE_HINTS[request.kind]}
        confirmLabel={request.kind === "erasure" ? "Eliminar e concluir" : "Concluir"}
        tone={request.kind === "erasure" ? "danger" : "primary"}
        requireReason
        reasonLabel="O que foi feito"
        pending={complete.isPending}
        error={mutationError(complete.error)}
        onConfirm={(resolution) =>
          complete.mutateAsync({ id: request.id, resolution }).then(
            () => setDialog(null),
            () => undefined,
          )
        }
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={close}
        title={`Recusar ${request.code}`}
        description="Indique o fundamento legal ou a razão. O titular recebe esta resposta."
        confirmLabel="Recusar"
        tone="danger"
        requireReason
        reasonLabel="Fundamento da recusa"
        pending={reject.isPending}
        error={mutationError(reject.error)}
        onConfirm={(reason) =>
          reject.mutateAsync({ id: request.id, reason }).then(
            () => setDialog(null),
            () => undefined,
          )
        }
      />
    </div>
  );
}

export default function PrivacySheet({ requestId, onClose }: { requestId: string | null; onClose: () => void }) {
  const query = usePrivacyRequest(requestId);
  return (
    <Sheet open={requestId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{query.data ? `${query.data.code} · ${PRIVACY_KIND_LABELS[query.data.kind]}` : "Pedido de dados"}</SheetTitle>
            <SheetDescription className="sr-only">Detalhe do pedido de dados pessoais e acções.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) => <Body request={data} />}
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
