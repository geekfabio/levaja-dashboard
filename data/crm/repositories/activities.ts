import type { Activity } from "@/data/activities";
import type { Task, TaskStatus } from "@/data/tasks";

export interface ActivitiesRepository {
  list(): Promise<Activity[]>;
  create(activity: Activity): Promise<{ activity: Activity; offline: boolean }>;
  update(id: string, patch: Partial<Omit<Activity, "id">>): Promise<Activity>;
  remove(id: string): Promise<{ activity: Activity; index: number }>;
  restore(activity: Activity, index: number): Promise<Activity>;

  tasks(): Promise<Task[]>;
  createTask(task: Task): Promise<Task>;
  moveTaskStatus(id: string, status: TaskStatus): Promise<Task>;
  postponeTask(id: string, dueDate: string): Promise<Task>;
}
