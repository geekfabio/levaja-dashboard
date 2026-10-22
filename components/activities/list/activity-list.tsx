"use client";

import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { useActivitiesStore } from "@/stores/activities-store";
import Tag from "@/components/_ui/tag";
import { ACTIVITY_TONES, type Activity } from "@/data/activities";
import { formatDistance } from "@/lib/geo";
import { formatDateLong } from "@/lib/format";

type ActivityListProps = {
  activities: Activity[];
};

export default function ActivityList({ activities }: ActivityListProps) {
  const editActivity = useActivitiesStore((state) => state.editActivity);

  return (
    <ScrollArea className="min-h-0 flex-1">
      {activities.length === 0 ? (
        <div className="caption-style text-subtle flex h-full items-center justify-center p-8 text-center">
          Sem registos para os filtros escolhidos.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {activities.map((activity) => (
            <li key={activity.id} className="flex flex-col gap-2 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag tone={ACTIVITY_TONES[activity.type]}>
                    {activity.type}
                  </Tag>
                  <span className="lead-style font-medium">
                    {activity.companyName}
                  </span>
                  <Tag tone="neutral" size="sm">
                    {activity.zone}
                  </Tag>
                  {activity.checkIn && (
                    <Tag tone="green" size="sm">
                      Check-in
                      {activity.checkIn.distance !== undefined && ` · ${formatDistance(activity.checkIn.distance)}`}
                    </Tag>
                  )}
                  {activity.pendingSync && (
                    <Tag tone="amber" size="sm">
                      Por sincronizar
                    </Tag>
                  )}
                </div>
                <span className="flex items-center gap-2">
                  <span className="caption-style text-subtle">
                    {formatDateLong(activity.date)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar registo de ${activity.type.toLowerCase()} em ${activity.companyName}`}
                    onClick={() => editActivity(activity.id)}
                  >
                    Editar
                  </Button>
                </span>
              </div>
              <p className="p-style text-soft">{activity.note}</p>
              <span className="caption-style text-subtle">
                {activity.owner}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}
