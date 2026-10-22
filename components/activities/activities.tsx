"use client";

import { useMemo } from "react";
import ActivitiesHeader from "./header/header";
import ActivitiesToolbar from "./toolbar/toolbar";
import ActivitiesTotals from "./activities-totals";
import ActivityList from "./list/activity-list";
import ActivityCalendar from "./calendar/activity-calendar";
import TaskBoard from "./tasks/task-board";
import DailyRoute from "./route/daily-route";
import NewTaskDialog from "./new-task/new-task-dialog";
import { filterActivities } from "@/lib/activities";
import { filterTasks } from "@/lib/tasks";
import { useActivitiesStore } from "@/stores/activities-store";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Activities() {
  const activities = useActivitiesStore((state) => state.activities);
  const tasks = useActivitiesStore((state) => state.tasks);
  const type = useActivitiesStore((state) => state.type);
  const owner = useActivitiesStore((state) => state.owner);
  const companyId = useActivitiesStore((state) => state.companyId);
  const window_ = useActivitiesStore((state) => state.window);
  const search = useActivitiesStore((state) => state.search);
  const view = useActivitiesStore((state) => state.view);

  const todayIso = today();

  const visibleActivities = useMemo(
    () =>
      filterActivities(
        activities,
        { type, owner, companyId, window: window_, search },
        todayIso,
      ),
    [activities, type, owner, companyId, window_, search, todayIso],
  );

  const visibleTasks = useMemo(
    () => filterTasks(tasks, { owner, companyId, search }),
    [tasks, owner, companyId, search],
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ActivitiesHeader count={visibleActivities.length} />
      <ActivitiesTotals activities={visibleActivities} tasks={visibleTasks} today={todayIso} />
      <ActivitiesToolbar />
      {view === "lista" && <ActivityList activities={visibleActivities} />}
      {view === "calendario" && (
        <ActivityCalendar activities={visibleActivities} tasks={visibleTasks} />
      )}
      {view === "tarefas" && <TaskBoard tasks={visibleTasks} />}
      {view === "rota" && (
        <DailyRoute activities={activities} tasks={tasks} />
      )}
      <NewTaskDialog />
    </section>
  );
}
