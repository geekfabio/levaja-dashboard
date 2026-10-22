import { formatDateTimeNumeric } from "@/lib/format";
import { STATUS_FLOW, STATUS_LABELS } from "@/lib/leva-ja/status";
import { cn } from "@/lib/utils";
import type { ServiceRequest } from "@/types/leva-ja";

export default function RequestTimeline({ request }: { request: ServiceRequest }) {
  const done = new Set(request.timeline.map((event) => event.status));
  const pending =
    request.status === "cancelled" ? [] : STATUS_FLOW.slice(STATUS_FLOW.indexOf(request.status) + 1).filter((status) => !done.has(status));

  return (
    <ol className="flex flex-col">
      {request.timeline.map((event, index) => {
        const last = index === request.timeline.length - 1 && pending.length === 0;
        return (
          <li key={`${event.status}-${event.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden className="bg-line-strong absolute top-4 bottom-0 left-[5px] w-px" />}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 size-[11px] shrink-0 rounded-full border-2",
                event.status === "cancelled" ? "border-danger bg-danger" : "border-primary bg-primary",
              )}
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="lead-style">{STATUS_LABELS[event.status]}</span>
              <span className="caption-style text-subtle tabular-nums">{formatDateTimeNumeric(event.at)}</span>
            </span>
          </li>
        );
      })}
      {pending.map((status, index) => (
        <li key={status} className="relative flex gap-3 pb-4 last:pb-0">
          {index < pending.length - 1 && <span aria-hidden className="bg-border absolute top-4 bottom-0 left-[5px] w-px" />}
          <span aria-hidden className="border-line-strong bg-card relative mt-1 size-[11px] shrink-0 rounded-full border-2" />
          <span className="lead-style text-subtle">
            {STATUS_LABELS[status]}
            <span className="sr-only"> (por concluir)</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
