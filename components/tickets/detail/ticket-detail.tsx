"use client";

import { useState, type FormEvent } from "react";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import DetailSection from "@/components/_common/detail-section";
import Tag from "@/components/_ui/tag";
import { Textarea } from "@/components/_ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/data/tickets";
import { formatDateTime } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import SlaBadge from "../sla/sla-badge";
import SlaSection from "../sla/sla-section";
import { useTicketsStore } from "@/stores/tickets-store";
import { CURRENT_USER, OWNERS, profileByName } from "@/data/companies";
import MessageIcon from "@/public/assets/images/companies/sidebar/message-question.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export default function TicketDetail() {
  const detailId = useTicketsStore((state) => state.detailId);
  const detailOpen = useTicketsStore((state) => state.detailOpen);
  const tickets = useTicketsStore((state) => state.tickets);
  const closeDetail = useTicketsStore((state) => state.closeDetail);
  const setTicketStatus = useTicketsStore((state) => state.setTicketStatus);
  const setTicketPriority = useTicketsStore((state) => state.setTicketPriority);
  const addComment = useTicketsStore((state) => state.addComment);
  const setTicketAssignee = useTicketsStore((state) => state.setTicketAssignee);
  const [comment, setComment] = useState("");
  const now = useNow();

  const ticket = tickets.find((item) => item.id === detailId);

  function handleSubmitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket) return;
    const body = comment.trim();
    if (!body) return;
    addComment(ticket.id, body);
    setComment("");
  }

  return (
    <Sheet
      open={detailOpen && ticket !== undefined}
      onOpenChange={(open) => !open && closeDetail()}
    >
      <SheetContent side="right" className="sm:w-[520px] sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <MessageIcon aria-hidden className="text-icon size-3.5" />
            <SheetTitle>Detalhe do Ticket</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Resumo, cronograma e comentários do ticket
          </SheetDescription>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1"
              aria-label="Fechar detalhe"
            >
              <XIcon aria-hidden className="text-foreground size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {ticket && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
              <h2>{ticket.subject}</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <SlaBadge ticket={ticket} now={now} />
              </div>
              <span className="caption-style text-subtle">
                {ticket.companyName ?? "Sem cliente associado"}
                {ticket.contactName ? ` · ${ticket.contactName}` : ""}
              </span>
              <p className="p-style text-soft">{ticket.description}</p>
            </div>

            <DetailSection title="Estado e prioridade">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={ticket.status}
                  onValueChange={(value) =>
                    setTicketStatus(ticket.id, value as TicketStatus)
                  }
                >
                  <SelectTrigger aria-label="Estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={ticket.priority}
                  onValueChange={(value) =>
                    setTicketPriority(ticket.id, value as TicketPriority)
                  }
                >
                  <SelectTrigger aria-label="Prioridade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                <label htmlFor="ticket-assignee" className="caption-style text-subtle">
                  Responsável
                </label>
                <Select
                  value={ticket.assignee}
                  onValueChange={(value) => {
                    const person = profileByName(value);
                    setTicketAssignee(ticket.id, value, person.avatar);
                  }}
                >
                  <SelectTrigger id="ticket-assignee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[CURRENT_USER, ...OWNERS]
                      .filter((person, index, all) => all.findIndex((item) => item.name === person.name) === index)
                      .concat(
                        [CURRENT_USER, ...OWNERS].some((person) => person.name === ticket.assignee)
                          ? []
                          : [{ ...CURRENT_USER, name: ticket.assignee }],
                      )
                      .map((person) => (
                        <SelectItem key={person.name} value={person.name}>
                          {person.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="caption-style text-subtle">Origem: {ticket.origin}</span>
            </DetailSection>

            <DetailSection title="Acordo de nível de serviço (SLA)">
              <SlaSection ticket={ticket} now={now} />
            </DetailSection>

            <DetailSection title="Cronograma">
              <ol className="flex flex-col gap-3">
                {ticket.timeline.map((event) => (
                  <li key={event.id} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="bg-subtle mt-1.5 size-1.5 shrink-0 rounded-full"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="lead-style">{event.label}</span>
                      <span className="caption-style text-subtle">
                        {formatDateTime(event.date)} · {event.author}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </DetailSection>

            <DetailSection title="Comentários" className="shadow-none">
              <div className="flex flex-col gap-4">
                {ticket.comments.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <Avatar src={item.authorAvatar} alt="" className="size-7" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="caption-style flex items-center gap-1.5">
                        <span className="text-foreground font-medium">
                          {item.author}
                        </span>
                        <span className="text-subtle">
                          {formatDateTime(item.date)}
                        </span>
                      </span>
                      <p className="p-style border-line-strong text-soft rounded-lg border bg-white/3 px-3 py-2">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
                {ticket.comments.length === 0 && (
                  <span className="caption-style text-subtle">
                    Ainda sem comentários.
                  </span>
                )}

                <form
                  onSubmit={handleSubmitComment}
                  className="flex flex-col gap-2"
                >
                  <Textarea
                    aria-label="Novo comentário"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Escreva um comentário…"
                    rows={3}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={!comment.trim()}
                    className="self-end"
                  >
                    Comentar
                  </Button>
                </form>
              </div>
            </DetailSection>
          </div>
        )}

        <SheetFooter>
          <Tag tone="neutral" size="sm">
            {ticket ? `Criado em ${formatDateTime(ticket.createdAt)}` : ""}
          </Tag>
          <SheetClose asChild>
            <Button variant="subtle" size="sm">
              Fechar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
