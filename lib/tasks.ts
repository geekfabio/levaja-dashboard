import { TASK_STATUSES, type Task, type TaskStatus } from "@/data/tasks";
import { ALL_COMPANIES, ALL_OWNERS } from "@/lib/activities";

export type TaskFilters = {
  owner: string;
  companyId: string;
  search: string;
};

export function filterTasks(
  tasks: Task[],
  { owner, companyId, search }: TaskFilters,
): Task[] {
  const query = search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (owner !== ALL_OWNERS && task.assignee !== owner) return false;
    if (companyId !== ALL_COMPANIES && task.companyId !== companyId)
      return false;
    if (
      query &&
      !task.title.toLowerCase().includes(query) &&
      !(task.companyName ?? "").toLowerCase().includes(query)
    )
      return false;
    return true;
  });
}

export function groupTasksByStatus(tasks: Task[]): Map<TaskStatus, Task[]> {
  const groups = new Map<TaskStatus, Task[]>(
    TASK_STATUSES.map((status) => [status, []]),
  );
  for (const task of tasks) {
    groups.get(task.status)?.push(task);
  }
  return groups;
}

function daysUntil(dateIso: string, todayIso: string) {
  const date = new Date(`${dateIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.round((date - today) / 86_400_000);
}

export function isOverdue(task: Task, todayIso: string) {
  return task.status !== "Feita" && daysUntil(task.dueDate, todayIso) < 0;
}

export function isDueSoon(task: Task, todayIso: string) {
  if (task.status === "Feita") return false;
  const diff = daysUntil(task.dueDate, todayIso);
  return diff >= 0 && diff <= 2;
}
