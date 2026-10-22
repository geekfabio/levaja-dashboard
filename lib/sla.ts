import { CLOSED_STATUSES, SLA_POLICIES, type Ticket } from "@/data/tickets";
import { formatDuration, luandaLocalToDate } from "./format";

const HOUR = 60 * 60 * 1000;
const RISK_SHARE = 0.25;

export type SlaPhase = "Primeira resposta" | "Resolução";

export type SlaState = "ok" | "risk" | "breached" | "paused" | "met" | "missed";

export type SlaClock = {
  phase: SlaPhase;
  state: SlaState;
  targetMs: number;
  dueAt: number;
  elapsedMs: number;
  remainingMs: number;
};

export type SlaMilestone = {
  phase: SlaPhase;
  targetHours: number;
  dueAt: number;
  doneAt?: number;
  state: SlaState;
};

function time(local: string) {
  return luandaLocalToDate(local).getTime();
}

function liveState(remainingMs: number, targetMs: number): SlaState {
  if (remainingMs < 0) return "breached";
  if (remainingMs < targetMs * RISK_SHARE) return "risk";
  return "ok";
}

export function isClosed(ticket: Ticket) {
  return CLOSED_STATUSES.includes(ticket.status);
}

export function ticketMilestones(ticket: Ticket, now: number | null): SlaMilestone[] {
  const policy = SLA_POLICIES[ticket.priority];
  const created = time(ticket.createdAt);
  const paused = ticket.status === "Em Espera";

  function milestone(phase: SlaPhase, targetHours: number, done?: string): SlaMilestone {
    const dueAt = created + targetHours * HOUR;
    if (done) {
      const doneAt = time(done);
      return { phase, targetHours, dueAt, doneAt, state: doneAt <= dueAt ? "met" : "missed" };
    }
    if (paused) return { phase, targetHours, dueAt, state: "paused" };
    const remaining = now === null ? Infinity : dueAt - now;
    return { phase, targetHours, dueAt, state: liveState(remaining, targetHours * HOUR) };
  }

  return [
    milestone("Primeira resposta", policy.firstResponseHours, ticket.firstResponseAt),
    milestone("Resolução", policy.resolutionHours, ticket.resolvedAt),
  ];
}

export function ticketSla(ticket: Ticket, now: number | null): SlaClock {
  const [response, resolution] = ticketMilestones(ticket, now);
  const current = isClosed(ticket) || ticket.firstResponseAt ? resolution : response;
  const created = time(ticket.createdAt);
  const targetMs = current.targetHours * HOUR;
  const end = current.doneAt ?? now ?? created;
  return {
    phase: current.phase,
    state: current.state,
    targetMs,
    dueAt: current.dueAt,
    elapsedMs: end - created,
    remainingMs: current.dueAt - end,
  };
}

export function slaLabel(clock: SlaClock) {
  const response = clock.phase === "Primeira resposta";
  switch (clock.state) {
    case "met":
      return "Cumprido";
    case "missed":
      return `Fora do prazo (+${formatDuration(-clock.remainingMs)})`;
    case "paused":
      return "Pausado — a aguardar";
    case "breached":
      return `${response ? "Resposta" : "Resolução"} atrasada ${formatDuration(-clock.remainingMs)}`;
    default:
      return `${response ? "Responder" : "Resolver"} em ${formatDuration(clock.remainingMs)}`;
  }
}

const URGENCY: Record<SlaState, number> = {
  breached: 0,
  risk: 1,
  ok: 2,
  paused: 3,
  missed: 4,
  met: 5,
};

export function sortByUrgency(tickets: Ticket[], now: number | null) {
  if (now === null) return tickets;
  return [...tickets].sort((a, b) => {
    const left = ticketSla(a, now);
    const right = ticketSla(b, now);
    return URGENCY[left.state] - URGENCY[right.state] || left.dueAt - right.dueAt;
  });
}

export type SlaSummary = {
  open: number;
  risk: number;
  breached: number;
  compliance: number | null;
};

export function slaSummary(tickets: Ticket[], now: number | null): SlaSummary {
  const clocks = tickets.map((ticket) => ({ ticket, clock: ticketSla(ticket, now) }));
  const closed = clocks.filter(({ ticket }) => isClosed(ticket));
  const met = closed.filter(({ clock }) => clock.state === "met").length;
  return {
    open: clocks.length - closed.length,
    risk: clocks.filter(({ clock }) => clock.state === "risk").length,
    breached: clocks.filter(({ clock }) => clock.state === "breached").length,
    compliance: closed.length ? Math.round((met / closed.length) * 100) : null,
  };
}
