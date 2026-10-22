"use client";

import { useMemo } from "react";
import Tag from "@/components/_ui/tag";
import { ACTIVITY_TONES } from "@/data/activities";
import { CAMPAIGN_EVENT_TONES } from "@/data/campaign-events";
import { CHANNEL_LABELS } from "@/data/campaigns";
import { clientTimeline } from "@/lib/campaigns";
import { formatDateLong, formatDateTime } from "@/lib/format";
import { useActivitiesStore } from "@/stores/activities-store";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useContactsStore } from "@/stores/contacts-store";

type ClientTimelineProps = {
  companyId: string;
};

export default function ClientTimeline({ companyId }: ClientTimelineProps) {
  const contacts = useContactsStore((state) => state.contacts);
  const activities = useActivitiesStore((state) => state.activities);
  const campaigns = useCampaignsStore((state) => state.campaigns);

  const items = useMemo(
    () => clientTimeline(companyId, contacts, activities, campaigns),
    [companyId, contacts, activities, campaigns],
  );

  if (items.length === 0) {
    return (
      <span className="caption-style text-subtle">
        Sem atividades nem campanhas registadas para este cliente.
      </span>
    );
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex pb-5 pl-5 last:pb-0">
          {index < items.length - 1 && (
            <span aria-hidden className="bg-line-strong absolute top-4 bottom-0 left-[3.5px] w-px" />
          )}
          <span aria-hidden className="bg-subtle absolute top-[7px] left-0 size-2 rounded-full" />
          {item.kind === "activity" ? (
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2">
                <Tag tone={ACTIVITY_TONES[item.activity.type]} size="sm">
                  {item.activity.type}
                </Tag>
                <span className="caption-style text-subtle">
                  {formatDateLong(item.activity.date)}
                </span>
              </span>
              <span className="lead-style">{item.activity.note}</span>
              <span className="caption-style text-subtle">{item.activity.owner}</span>
            </span>
          ) : (
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <Tag tone={CAMPAIGN_EVENT_TONES[item.eventType]} size="sm">
                  {item.campaign ? `${CHANNEL_LABELS[item.campaign.channel]} · ` : ""}
                  {item.eventType}
                </Tag>
                <span className="caption-style text-subtle">
                  {formatDateTime(item.event.date)}
                </span>
              </span>
              <span className="lead-style">{item.campaign?.name ?? "Campanha removida"}</span>
              <span className="caption-style text-subtle">
                {item.contact?.name}
                {item.event.detail ? ` · ${item.event.detail}` : ""}
              </span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
