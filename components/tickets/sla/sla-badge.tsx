"use client";

import Tag from "@/components/_ui/tag";
import type { Ticket } from "@/data/tickets";
import { slaLabel, ticketSla, type SlaState } from "@/lib/sla";
import ClockIcon from "@/public/assets/images/companies/detail/clock.svg";
import AlertIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";

export const SLA_TONES: Record<SlaState, "neutral" | "amber" | "red" | "purple" | "green" | "orange"> = {
  ok: "neutral",
  risk: "amber",
  breached: "red",
  paused: "purple",
  met: "green",
  missed: "orange",
};

export const SLA_ICONS = {
  ok: ClockIcon,
  risk: ClockIcon,
  breached: AlertIcon,
  paused: ClockIcon,
  met: null,
  missed: AlertIcon,
} satisfies Record<SlaState, unknown>;

type SlaBadgeProps = {
  ticket: Ticket;
  now: number | null;
};

export default function SlaBadge({ ticket, now }: SlaBadgeProps) {
  const clock = ticketSla(ticket, now);
  const live = clock.state === "ok" || clock.state === "risk" || clock.state === "breached";

  if (live && now === null) {
    return (
      <span
        aria-hidden
        className="inline-block h-[22px] w-28 rounded-full bg-white/6 motion-safe:animate-pulse"
      />
    );
  }

  const Icon = SLA_ICONS[clock.state];
  return (
    <Tag tone={SLA_TONES[clock.state]} size="sm" className="gap-1 tabular-nums">
      {Icon && <Icon aria-hidden className="size-3" />}
      {slaLabel(clock)}
    </Tag>
  );
}
