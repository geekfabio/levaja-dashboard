"use client";

import type { Ticket } from "@/data/tickets";
import { SLA_POLICIES } from "@/data/tickets";
import { formatDateTimeShort, formatDuration, luandaLocalToDate } from "@/lib/format";
import { ticketMilestones, type SlaMilestone } from "@/lib/sla";
import { cn } from "@/lib/utils";
import Tag from "@/components/_ui/tag";
import { SLA_ICONS, SLA_TONES } from "./sla-badge";

const HOUR = 60 * 60 * 1000;

const STATE_LABELS = {
  ok: "No prazo",
  risk: "Em risco",
  breached: "Atrasado",
  paused: "Pausado",
  met: "Cumprido",
  missed: "Fora do prazo",
} as const;

const BAR_COLORS = {
  ok: "bg-primary",
  risk: "bg-warning",
  breached: "bg-danger",
  paused: "bg-subtle",
  met: "bg-(--tag-green-text)",
  missed: "bg-(--tag-orange-text)",
} as const;

function dueText(ticket: Ticket, milestone: SlaMilestone, now: number | null) {
  if (milestone.doneAt !== undefined) {
    const took = milestone.doneAt - luandaLocalToDate(ticket.createdAt).getTime();
    return `Feito em ${formatDuration(took)}`;
  }
  if (milestone.state === "paused") return "Relógio parado enquanto aguarda o cliente";
  if (now === null) return "";
  const remaining = milestone.dueAt - now;
  return remaining >= 0
    ? `Faltam ${formatDuration(remaining)}`
    : `Ultrapassado há ${formatDuration(-remaining)}`;
}

function MilestoneRow({
  ticket,
  milestone,
  now,
}: {
  ticket: Ticket;
  milestone: SlaMilestone;
  now: number | null;
}) {
  const created = luandaLocalToDate(ticket.createdAt).getTime();
  const target = milestone.targetHours * HOUR;
  const end = milestone.doneAt ?? now ?? created;
  const share = Math.min(Math.max((end - created) / target, 0), 1);
  const Icon = SLA_ICONS[milestone.state];
  const dueLocal = new Date(milestone.dueAt + HOUR).toISOString().slice(0, 16);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="lead-style font-medium">
          {milestone.phase}
          <span className="caption-style text-subtle font-normal"> · até {milestone.targetHours} h</span>
        </span>
        <Tag tone={SLA_TONES[milestone.state]} size="sm" className="gap-1">
          {Icon && <Icon aria-hidden className="size-3" />}
          {STATE_LABELS[milestone.state]}
        </Tag>
      </div>
      <div
        role="progressbar"
        aria-label={`${milestone.phase}: tempo de SLA usado`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/6"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300 ease-power3-out",
            BAR_COLORS[milestone.state],
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="caption-style text-subtle flex flex-wrap justify-between gap-x-3">
        <span>{dueText(ticket, milestone, now)}</span>
        <span className="tabular-nums">Prazo: {formatDateTimeShort(dueLocal)}</span>
      </span>
    </div>
  );
}

export default function SlaSection({ ticket, now }: { ticket: Ticket; now: number | null }) {
  const milestones = ticketMilestones(ticket, now);
  const policy = SLA_POLICIES[ticket.priority];

  return (
    <div className="flex flex-col gap-4">
      {milestones.map((milestone) => (
        <MilestoneRow key={milestone.phase} ticket={ticket} milestone={milestone} now={now} />
      ))}
      <span className="caption-style text-faint">
        Prioridade {ticket.priority.toLowerCase()}: resposta em {policy.firstResponseHours} h e
        resolução em {policy.resolutionHours} h, contadas em horas corridas.
      </span>
    </div>
  );
}
