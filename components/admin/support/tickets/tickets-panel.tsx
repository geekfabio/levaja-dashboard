"use client";

import { useEffect, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { usePlatformSettings } from "@/hooks/admin/use-settings";
import { useResponseSummary, useTickets } from "@/hooks/admin/use-support";
import { formatElapsed, formatMinutes, formatNumber, formatPercent } from "@/lib/format";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/leva-ja/services";
import { ticketResponseSla } from "@/lib/leva-ja/trust";
import type { ResponseSla } from "@/lib/leva-ja/trust";
import type { Ticket, TicketPriority, TicketStatus } from "@/types/leva-ja";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import TicketSheet, { TICKET_PRIORITY_TONES, TICKET_STATUS_TONES } from "./ticket-sheet";

const STATUS_OPTIONS = [
  { value: "unresolved", label: "Por resolver" },
  { value: "all", label: "Todas" },
  ...(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((status) => ({ value: status, label: TICKET_STATUS_LABELS[status] })),
];
const PRIORITY_OPTIONS = [{ value: "all", label: "Todas" }, ...(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((priority) => ({ value: priority, label: TICKET_PRIORITY_LABELS[priority] }))];

const SLA_TONES = { met: "success", breached: "danger", pending: "neutral", at_risk: "warning" } as const;

function slaLabel(sla: ResponseSla, now: number) {
  if (sla.status === "met") return "Cumprida";
  if (sla.respondedAt) return "Respondida fora do prazo";
  if (sla.status === "breached") return `Atrasada ${formatElapsed(sla.dueAt, now)}`;
  return `Faltam ${formatMinutes(Math.max(1, sla.minutesLeft))}`;
}

function SlaBadge({ sla, now }: { sla: ResponseSla; now: number }) {
  return <ToneBadge tone={SLA_TONES[sla.status]} label={slaLabel(sla, now)} />;
}

type Props = { userId: string; canOpenRequest: boolean; canOpenRequester: (ticket: Ticket) => boolean };

export default function TicketsPanel({ userId, canOpenRequest, canOpenRequester }: Props) {
  const now = useClock();
  const settings = usePlatformSettings();
  const summary = useResponseSummary();
  const hours = settings.data?.support.firstResponseHours;
  const [status, setStatus] = useState("unresolved");
  const [priority, setPriority] = useState("all");
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useTickets({
    status: status === "all" ? undefined : status === "unresolved" ? ["open", "in_progress"] : [status as TicketStatus],
    priority: priority === "all" ? undefined : [priority as TicketPriority],
    assigneeId: mine ? userId : undefined,
    q: q || undefined,
    page,
    pageSize: 15,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <SummaryTiles
        tiles={
          summary.data
            ? [
                { label: "Sem resposta, dentro do prazo", value: summary.data.pending, display: formatNumber(summary.data.pending) },
                { label: "Prazo quase a terminar", value: summary.data.atRisk, display: formatNumber(summary.data.atRisk) },
                { label: "Prazo ultrapassado sem resposta", value: summary.data.breached, display: formatNumber(summary.data.breached) },
                { label: "Respondidas no prazo", value: Math.round((summary.data.metRate ?? 0) * 100), display: summary.data.metRate === null ? "—" : formatPercent(summary.data.metRate * 100) },
              ]
            : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[300px]">
          <span className="sr-only">Pesquisar por código, assunto ou requerente</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Código, assunto ou requerente" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
        </label>
        <FilterMenu label="Estado" value={status} options={STATUS_OPTIONS} onChange={(value) => { setStatus(value); setPage(1); }} />
        <FilterMenu label="Prioridade" value={priority} options={PRIORITY_OPTIONS} onChange={(value) => { setPriority(value); setPage(1); }} />
        <Button variant={mine ? "muted" : "ghost"} size="sm" aria-pressed={mine} onClick={() => { setMine(!mine); setPage(1); }}>
          Atribuídas a mim
        </Button>
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem ocorrências", description: "Não há ocorrências com estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Ocorrências" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Ocorrência</TableHead>
                    <TableHead scope="col">Requerente</TableHead>
                    <TableHead scope="col">Prioridade</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col">Primeira resposta</TableHead>
                    <TableHead scope="col">Responsável</TableHead>
                    <TableHead scope="col">Actualizada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((ticket) => (
                    <TableRow key={ticket.id} className="hover:bg-muted/60 cursor-pointer" onClick={() => setOpenId(ticket.id)}>
                      <TableCell className="max-w-[320px]">
                        <Button variant="link" size="none" className="max-w-full truncate" onClick={(event) => { event.stopPropagation(); setOpenId(ticket.id); }}>
                          {ticket.code} · {ticket.subject}
                        </Button>
                      </TableCell>
                      <TableCell className="text-soft">
                        {ticket.requesterName}
                        <span className="caption-style text-subtle ml-1.5">{ticket.requesterKind === "client" ? "cliente" : "prestador"}</span>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={TICKET_PRIORITY_TONES[ticket.priority]} label={TICKET_PRIORITY_LABELS[ticket.priority]} />
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={TICKET_STATUS_TONES[ticket.status]} label={TICKET_STATUS_LABELS[ticket.status]} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{hours ? <SlaBadge sla={ticketResponseSla(ticket, hours, now)} now={now} /> : "—"}</TableCell>
                      <TableCell className="text-soft">{ticket.assigneeName ?? "Por atribuir"}</TableCell>
                      <TableCell className="text-soft tabular-nums">há {formatElapsed(ticket.updatedAt, now)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das ocorrências" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
      <TicketSheet ticketId={openId} onClose={() => setOpenId(null)} canOpenRequest={canOpenRequest} canOpenRequester={canOpenRequester} />
    </div>
  );
}
