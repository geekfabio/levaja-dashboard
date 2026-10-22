"use client";

import { useMemo, useState } from "react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import DetailSection from "@/components/_common/detail-section";
import { ACTIVITY_TONES, type Activity } from "@/data/activities";
import type { Task } from "@/data/tasks";
import {
  buildMonthGrid,
  groupActivitiesByDay,
  monthLabel,
} from "@/lib/activities";
import { formatDateLong } from "@/lib/format";
import { useActivitiesStore } from "@/stores/activities-store";
import { cn } from "@/lib/utils";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";

type ActivityCalendarProps = {
  activities: Activity[];
  tasks: Task[];
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const DOT_TONE: Record<string, string> = {
  blue: "bg-(--tag-blue-text)",
  purple: "bg-(--tag-purple-text)",
  green: "bg-(--tag-green-text)",
  amber: "bg-(--tag-amber-text)",
  teal: "bg-(--tag-teal-text)",
  red: "bg-(--tag-red-text)",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ActivityCalendar({
  activities,
  tasks,
}: ActivityCalendarProps) {
  const calendarMonth = useActivitiesStore((state) => state.calendarMonth);
  const shiftCalendarMonth = useActivitiesStore(
    (state) => state.shiftCalendarMonth,
  );
  const [selectedDate, setSelectedDate] = useState(today());

  const grid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);
  const byDay = useMemo(() => groupActivitiesByDay(activities), [activities]);
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [tasks]);

  const selectedActivities = byDay.get(selectedDate) ?? [];
  const selectedTasks = tasksByDay.get(selectedDate) ?? [];

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <span className="lead-style font-medium">
          {monthLabel(calendarMonth)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => shiftCalendarMonth(-1)}
          >
            <ChevronDownIcon aria-hidden className="size-3 rotate-90" />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Mês seguinte"
            onClick={() => shiftCalendarMonth(1)}
          >
            <ChevronDownIcon aria-hidden className="size-3 -rotate-90" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 px-4 py-4">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="caption-style text-subtle px-1 text-center"
          >
            {weekday}
          </span>
        ))}

        {grid.flat().map((cell) => {
          const dayActivities = byDay.get(cell.date) ?? [];
          const types = Array.from(
            new Set(dayActivities.map((activity) => activity.type)),
          );
          const hasTask = tasksByDay.has(cell.date);
          const isSelected = cell.date === selectedDate;

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelectedDate(cell.date)}
              className={cn(
                "ease-power3-out flex h-[64px] flex-col items-start gap-1 rounded-lg border border-transparent p-1.5 text-left transition-colors duration-150 hover:bg-white/4",
                cell.inMonth ? "text-foreground" : "text-subtle/50",
                isSelected && "border-line-strong bg-white/5",
              )}
            >
              <span className="caption-style tabular-nums">{cell.day}</span>
              <div className="flex flex-wrap items-center gap-0.5">
                {types.slice(0, 3).map((type) => (
                  <span
                    key={type}
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      DOT_TONE[ACTIVITY_TONES[type]],
                    )}
                  />
                ))}
                {hasTask && (
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full border border-subtle"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <DetailSection title={formatDateLong(selectedDate)}>
        {selectedActivities.length === 0 && selectedTasks.length === 0 ? (
          <p className="caption-style text-subtle">
            Sem registos nem tarefas neste dia.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedActivities.map((activity) => (
              <div key={activity.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Tag tone={ACTIVITY_TONES[activity.type]} size="sm">
                    {activity.type}
                  </Tag>
                  <span className="lead-style font-medium">
                    {activity.companyName}
                  </span>
                </div>
                <p className="caption-style text-subtle">{activity.note}</p>
              </div>
            ))}
            {selectedTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <Tag tone="neutral" size="sm">
                  Tarefa
                </Tag>
                <span className="lead-style">{task.title}</span>
                <span className="caption-style text-subtle">
                  {task.assignee}
                </span>
              </div>
            ))}
          </div>
        )}
      </DetailSection>
    </ScrollArea>
  );
}
