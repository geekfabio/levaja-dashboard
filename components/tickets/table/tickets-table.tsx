"use client";

import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import {
  TICKET_PRIORITY_TONES,
  TICKET_STATUS_TONES,
  type Ticket,
} from "@/data/tickets";
import { formatDateTimeShort, formatRelative } from "@/lib/format";
import SlaBadge from "../sla/sla-badge";
import { useTicketsStore } from "@/stores/tickets-store";

type TicketsTableProps = {
  tickets: Ticket[];
  now: number | null;
};

export default function TicketsTable({ tickets, now }: TicketsTableProps) {
  const openDetail = useTicketsStore((state) => state.openDetail);

  return (
    <ScrollArea orientation="both" className="min-h-0 flex-1">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Assunto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow
              key={ticket.id}
              onClick={() => openDetail(ticket.id)}
              className="hover:bg-card/60 cursor-pointer"
            >
              <TableCell className="max-w-[280px]">
                <Button
                  variant="link"
                  size="none"
                  title={ticket.subject}
                  className="block max-w-full truncate text-left no-underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDetail(ticket.id);
                  }}
                >
                  {ticket.subject}
                </Button>
                <span className="caption-style text-subtle mt-1 block">{ticket.origin}</span>
              </TableCell>
              <TableCell className="text-soft">
                {ticket.companyName ?? "—"}
              </TableCell>
              <TableCell>
                <Tag tone={TICKET_STATUS_TONES[ticket.status]}>
                  {ticket.status}
                </Tag>
              </TableCell>
              <TableCell>
                <Tag tone={TICKET_PRIORITY_TONES[ticket.priority]}>
                  {ticket.priority}
                </Tag>
              </TableCell>
              <TableCell>
                <SlaBadge ticket={ticket} now={now} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <Avatar src={ticket.assigneeAvatar} alt="" />
                  {ticket.assignee}
                </span>
              </TableCell>
              <TableCell className="text-soft tabular-nums">
                <time dateTime={ticket.updatedAt}>
                  {now === null
                    ? formatDateTimeShort(ticket.updatedAt)
                    : formatRelative(ticket.updatedAt, now)}
                </time>
              </TableCell>
            </TableRow>
          ))}
          {tickets.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="caption-style text-subtle h-[120px] text-center"
              >
                Nenhum ticket corresponde aos filtros atuais. Limpe os filtros ou escolha outro indicador acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
