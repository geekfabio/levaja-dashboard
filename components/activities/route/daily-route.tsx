"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Checkbox } from "@/components/_ui/checkbox";
import Tag from "@/components/_ui/tag";
import Avatar from "@/components/_ui/avatar";
import DetailSection from "@/components/_common/detail-section";
import { ACTIVITY_TONES, type Activity } from "@/data/activities";
import { ownerByName } from "@/data/companies";
import { useSettingsStore } from "@/stores/settings-store";
import type { Task } from "@/data/tasks";
import { groupActivitiesByZone } from "@/lib/activities";
import { formatDateLong, formatTime } from "@/lib/format";
import { useActivitiesStore } from "@/stores/activities-store";
import { useToday } from "@/hooks/use-today";
import { formatDistance } from "@/lib/geo";
import PlannedVisits from "./planned-visits";

type DailyRouteProps = {
  activities: Activity[];
  tasks: Task[];
};

export default function DailyRoute({ activities, tasks }: DailyRouteProps) {
  const moveTaskStatus = useActivitiesStore((state) => state.moveTaskStatus);
  const zones = useSettingsStore((state) => state.zones);
  const todayIso = useToday();

  const todaysActivities = useMemo(
    () => activities.filter((activity) => activity.date === todayIso),
    [activities, todayIso],
  );
  const todaysTasks = useMemo(
    () => tasks.filter((task) => task.dueDate === todayIso),
    [tasks, todayIso],
  );

  const byZone = groupActivitiesByZone(todaysActivities);
  const zoneNames = zones.map((zone) => zone.name);
  const zoneOrder = [
    ...zoneNames,
    ...[...byZone.keys()].filter((zone) => !zoneNames.includes(zone)),
  ];

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-1 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
        <span className="eyebrow-style text-subtle">Rota do dia</span>
        <h2 className="truncate">{formatDateLong(todayIso)}</h2>
      </div>

      <PlannedVisits />

      {zoneOrder.map((zone) => {
        const zoneActivities = byZone.get(zone) ?? [];
        if (zoneActivities.length === 0) return null;

        return (
          <DetailSection key={zone} title={`${zone} · ${zoneActivities.length}`}>
            <div className="flex flex-col gap-3">
              {zoneActivities.map((activity) => (
                <div key={activity.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Tag tone={ACTIVITY_TONES[activity.type]} size="sm">
                      {activity.type}
                    </Tag>
                    <span className="lead-style font-medium">
                      {activity.companyName}
                    </span>
                  </div>
                  <span className="caption-style text-subtle">
                    {activity.owner} · {activity.note}
                  </span>
                  {activity.checkIn && (
                    <span className="caption-style text-soft">
                      Check-in às {formatTime(activity.checkIn.at)}
                      {activity.checkIn.distance !== undefined &&
                        ` · a ${formatDistance(activity.checkIn.distance)} da morada`}
                    </span>
                  )}
                  {activity.pendingSync && (
                    <Tag tone="amber" size="sm" className="self-start">
                      Por sincronizar
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        );
      })}

      {todaysActivities.length === 0 && (
        <div className="caption-style text-subtle px-5 py-4">
          Sem visitas registadas hoje.
        </div>
      )}

      <DetailSection title={`Tarefas de hoje · ${todaysTasks.length}`}>
        {todaysTasks.length === 0 ? (
          <p className="caption-style text-subtle">
            Sem tarefas com prazo hoje.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {todaysTasks.map((task) => {
              const assignee = ownerByName(task.assignee);
              return (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-start justify-between gap-3"
                >
                  <span className="flex flex-col gap-1">
                    <span className="lead-style font-medium">
                      {task.title}
                    </span>
                    <span className="caption-style text-subtle flex items-center gap-1.5">
                      <Avatar src={assignee.avatar} alt={assignee.name} />
                      {assignee.name}
                      {task.companyName ? ` · ${task.companyName}` : ""}
                    </span>
                  </span>
                  <Checkbox
                    checked={task.status === "Feita"}
                    onCheckedChange={() =>
                      moveTaskStatus(
                        task.id,
                        task.status === "Feita" ? "Por Fazer" : "Feita",
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        )}
      </DetailSection>
    </ScrollArea>
  );
}
