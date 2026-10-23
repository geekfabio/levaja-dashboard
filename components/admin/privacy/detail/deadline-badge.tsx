import { ToneBadge } from "@/components/admin/shared/status-badge";
import { formatDateNumeric } from "@/lib/format";
import { privacyUrgency } from "@/lib/leva-ja/trust";
import type { PrivacyRequest } from "@/types/leva-ja";

const URGENCY_TONES = {
  overdue: "danger",
  due_soon: "warning",
  ok: "neutral",
  closed: "neutral",
} as const;

export default function DeadlineBadge({ request, now }: { request: PrivacyRequest; now: number }) {
  const urgency = privacyUrgency(request, now);
  if (urgency === "closed") return <span className="caption-style text-subtle tabular-nums">{request.completedAt ? `Fechado a ${formatDateNumeric(request.completedAt)}` : "—"}</span>;
  const days = Math.ceil((Date.parse(request.dueAt) - now) / 86_400_000);
  const label = urgency === "overdue" ? `Atrasado ${Math.abs(days) || 1} dia(s)` : `${days} dia(s) · ${formatDateNumeric(request.dueAt)}`;
  return <ToneBadge tone={URGENCY_TONES[urgency]} label={label} />;
}
