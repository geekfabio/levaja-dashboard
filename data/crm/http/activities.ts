import type { Activity } from "@/data/activities";
import type { Task, TaskStatus } from "@/data/tasks";
import type { ActivitiesRepository } from "../repositories/activities";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpActivities(http: HttpClient): ActivitiesRepository {
  return {
    list: () => http.get<Activity[]>("/crm/activities"),
    create: async (activity: Activity) => ({ activity: await http.post<Activity>("/crm/activities", activity), offline: false }),
    update: (activityId, patch) => http.patch<Activity>(`/crm/activities/${id(activityId)}`, patch),
    remove: async (activityId) => ({ activity: await http.del<Activity>(`/crm/activities/${id(activityId)}`), index: 0 }),
    restore: (activity: Activity) => http.put<Activity>(`/crm/activities/${id(activity.id)}/restore`, activity),
    tasks: () => http.get<Task[]>("/crm/tasks"),
    createTask: (task: Task) => http.post<Task>("/crm/tasks", task),
    moveTaskStatus: (taskId, status: TaskStatus) => http.patch<Task>(`/crm/tasks/${id(taskId)}/status`, { status }),
    postponeTask: (taskId, dueDate) => http.patch<Task>(`/crm/tasks/${id(taskId)}/postpone`, { dueDate }),
  };
}
