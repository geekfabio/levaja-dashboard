"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Skeleton from "@/components/_ui/skeleton";
import { Textarea } from "@/components/_ui/textarea";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useAssignees, useAssignTicket, useReplyTicket, useResolveTicket, useTicket } from "@/hooks/admin/use-support";
import { formatDateTimeNumeric } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/leva-ja/services";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/leva-ja";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export const TICKET_STATUS_TONES = { open: "warning", in_progress: "info", resolved: "success" } as const;
export const TICKET_PRIORITY_TONES = { low: "neutral", medium: "info", high: "warning", urgent: "danger" } as const;

type Props = { ticketId: string | null; onClose: () => void; canOpenRequest: boolean; canOpenRequester: (ticket: Ticket) => boolean };

function TicketBody({ ticket, canOpenRequest, canOpenRequester }: { ticket: Ticket; canOpenRequest: boolean; canOpenRequester: boolean }) {
  const assignees = useAssignees(true);
  const assign = useAssignTicket();
  const reply = useReplyTicket();
  const resolve = useResolveTicket();
  const [body, setBody] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const resolved = ticket.status === "resolved";
  const requesterHref = `${ticket.requesterKind === "client" ? SECTION_ROUTES.clients : SECTION_ROUTES.providers}/${ticket.requesterId}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={TICKET_STATUS_TONES[ticket.status]} label={TICKET_STATUS_LABELS[ticket.status]} />
            <ToneBadge tone={TICKET_PRIORITY_TONES[ticket.priority]} label={`Prioridade ${TICKET_PRIORITY_LABELS[ticket.priority].toLowerCase()}`} />
          </div>
          <dl className="caption-style grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-subtle">{ticket.requesterKind === "client" ? "Cliente" : "Prestador"}</dt>
              <dd className="lead-style">
                {canOpenRequester ? (
                  <Button variant="link" size="none" href={requesterHref}>
                    {ticket.requesterName}
                  </Button>
                ) : (
                  ticket.requesterName
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-subtle">Pedido associado</dt>
              <dd className="lead-style">
                {ticket.requestId ? (
                  canOpenRequest ? (
                    <Button variant="link" size="none" href={`${SECTION_ROUTES.requests}/${ticket.requestId}`}>
                      Ver pedido
                    </Button>
                  ) : (
                    "Sim"
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-subtle">Aberta em</dt>
              <dd className="lead-style tabular-nums">{formatDateTimeNumeric(ticket.createdAt)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-subtle">Última actualização</dt>
              <dd className="lead-style tabular-nums">{formatDateTimeNumeric(ticket.updatedAt)}</dd>
            </div>
          </dl>

          {!resolved && (
            <Field label="Responsável" htmlFor="ticket-assignee">
              <Select value={ticket.assigneeId ?? ""} onValueChange={(adminId) => assign.mutate({ id: ticket.id, adminId })} disabled={assign.isPending || assignees.isPending}>
                <SelectTrigger id="ticket-assignee">
                  <SelectValue placeholder="Por atribuir" />
                </SelectTrigger>
                <SelectContent>
                  {(assignees.data ?? []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assign.error ? (
                <span role="alert" className="caption-style text-danger">
                  {mutationError(assign.error)}
                </span>
              ) : null}
            </Field>
          )}

          <section aria-label="Mensagens" className="flex flex-col gap-3">
            <h3 className="eyebrow-style text-faint font-normal">Mensagens</h3>
            <ol className="flex flex-col gap-3">
              {ticket.messages.map((message) => (
                <li
                  key={message.id}
                  className={cn(
                    "flex max-w-[90%] flex-col gap-1 rounded-xl px-4 py-3",
                    message.author === "admin" ? "bg-(--tag-green-bg) self-end" : "bg-muted self-start",
                  )}
                >
                  <span className="caption-style text-soft">
                    {message.authorName} · {formatDateTimeNumeric(message.at)}
                  </span>
                  <p className="p-style">{message.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {resolved && ticket.resolution && (
            <div className="flex flex-col gap-1 rounded-xl border border-(--tag-green-border) bg-(--tag-green-bg) p-4 text-(--tag-green-text)">
              <span className="lead-style font-medium">Resolvida</span>
              <span className="caption-style">{ticket.resolution}</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {!resolved && (
        <form
          className="border-line-strong flex flex-col gap-3 border-t p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim().length < 3) return;
            reply.mutateAsync({ id: ticket.id, body: body.trim() }).then(() => setBody(""), () => undefined);
          }}
        >
          <Field label="Responder" htmlFor="ticket-reply" error={reply.error ? (mutationError(reply.error) ?? undefined) : undefined}>
            <Textarea id="ticket-reply" rows={3} value={body} placeholder="Escreva a resposta ao utilizador." onChange={(event) => setBody(event.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="md" onClick={() => setResolveOpen(true)}>
              Resolver ocorrência
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={reply.isPending || body.trim().length < 3}>
              {reply.isPending ? "A enviar…" : "Enviar resposta"}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={resolveOpen}
        onOpenChange={(open) => {
          setResolveOpen(open);
          if (!open) resolve.reset();
        }}
        title={`Resolver ${ticket.code}`}
        description="A ocorrência fica fechada e o utilizador recebe a resolução."
        confirmLabel="Resolver"
        requireReason
        reasonLabel="Resolução"
        pending={resolve.isPending}
        error={mutationError(resolve.error)}
        onConfirm={(resolution) => resolve.mutateAsync({ id: ticket.id, resolution }).then(() => setResolveOpen(false), () => undefined)}
      />
    </div>
  );
}

export default function TicketSheet({ ticketId, onClose, canOpenRequest, canOpenRequester }: Props) {
  const query = useTicket(ticketId);
  const ticket = query.data;

  return (
    <Sheet open={ticketId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{ticket ? `${ticket.code} · ${ticket.subject}` : "Ocorrência"}</SheetTitle>
            <SheetDescription className="sr-only">Detalhe da ocorrência, mensagens e acções.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar">
              <XIcon aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <AsyncState query={query} skeleton={<Skeleton className="m-6 h-64" />} errorDescription={errorMessage}>
          {(data) => <TicketBody ticket={data} canOpenRequest={canOpenRequest} canOpenRequester={canOpenRequester(data)} />}
        </AsyncState>
      </SheetContent>
    </Sheet>
  );
}
