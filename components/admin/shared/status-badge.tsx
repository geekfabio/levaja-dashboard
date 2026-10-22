import Tag from "@/components/_ui/tag";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/leva-ja/status";
import type { StatusTone } from "@/lib/leva-ja/status";
import type { ServiceStatus } from "@/types/leva-ja";

export const TONE_TAGS: Record<StatusTone, "amber" | "blue" | "green" | "red" | "neutral"> = {
  warning: "amber",
  info: "blue",
  success: "green",
  danger: "red",
  neutral: "neutral",
};

type ToneBadgeProps = { tone: StatusTone; label: string; size?: "sm" | "md" };

export function ToneBadge({ tone, label, size = "sm" }: ToneBadgeProps) {
  return (
    <Tag tone={TONE_TAGS[tone]} size={size} className="gap-1.5">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </Tag>
  );
}

export default function RequestStatusBadge({ status, size }: { status: ServiceStatus; size?: "sm" | "md" }) {
  return <ToneBadge tone={STATUS_TONES[status]} label={STATUS_LABELS[status]} size={size} />;
}
