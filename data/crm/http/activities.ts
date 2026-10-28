import type { Activity } from "@/data/activities";
import type { Task, TaskStatus } from "@/data/tasks";
import type { ActivitiesRepository } from "../repositories/activities";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpActivities(http: HttpClient): ActivitiesRepository {
  return {
    list: () => http.get<Activity[]>("/crm/activities"),
    create: (activity: Activity) => http.post<{ activity: Activity; offline: boolean }>("/crm/activities", activity),
    update: (activityId, patch) => http.post<Activity>(`/crm/activities/${id(activityId)}`, patch),
    remove: (activityId) => http.post<{ activity: Activity; index: number }>(`/crm/activities/${id(activityId)}/remove`, {}),
    restore: (activity: Activity, index: number) => http.post<Activity>("/crm/activities/restore", { activity, index }),
    tasks: () => http.get<Task[]>("/crm/tasks"),
    createTask: (task: Task) => http.post<Task>("/crm/tasks", task),
    moveTaskStatus: (taskId, status: TaskStatus) => http.post<Task>(`/crm/tasks/${id(taskId)}/status`, { status }),
    postponeTask: (taskId, dueDate) => http.post<Task>(`/crm/tasks/${id(taskId)}/postpone`, { dueDate }),
  };
}
