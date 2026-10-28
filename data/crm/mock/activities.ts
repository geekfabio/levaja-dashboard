import type { Activity } from "@/data/activities";
import type { Task } from "@/data/tasks";
import { useActivitiesStore } from "@/stores/activities-store";
import { useFieldStore } from "@/stores/field-store";
import { RepositoryError } from "../repositories/errors";
import type { ActivitiesRepository } from "../repositories/activities";

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function activities() {
  return useActivitiesStore.getState().activities;
}

function setActivities(next: Activity[]) {
  useActivitiesStore.setState({ activities: next });
}

function tasks() {
  return useActivitiesStore.getState().tasks;
}

function setTasks(next: Task[]) {
  useActivitiesStore.setState({ tasks: next });
}

export function createMockActivities(latencyMs: number): ActivitiesRepository {
  function find(id: string) {
    const activity = activities().find((item) => item.id === id);
    if (!activity) throw new RepositoryError("not_found", "O registo não existe ou foi removido.");
    return activity;
  }

  function findTask(id: string) {
    const task = tasks().find((item) => item.id === id);
    if (!task) throw new RepositoryError("not_found", "A tarefa não existe ou foi removida.");
    return task;
  }

  return {
    list: async () => {
      await sleep(latencyMs);
      return structuredClone(activities());
    },

    create: async (input) => {
      await sleep(latencyMs);
      const field = useFieldStore.getState();
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const checkIn = input.type === "Visita" ? field.todaysCheckIn(input.companyId) : undefined;
      const activity: Activity = { ...input, checkIn: input.checkIn ?? checkIn, pendingSync: offline || undefined };
      if (offline) field.enqueue(activity);
      setActivities([activity, ...activities()]);
      return { activity: structuredClone(activity), offline };
    },

    update: async (id, patch) => {
      await sleep(latencyMs);
      find(id);
      const next = activities().map((item) => (item.id === id ? { ...item, ...patch } : item));
      setActivities(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    remove: async (id) => {
      await sleep(latencyMs);
      const index = activities().findIndex((item) => item.id === id);
      if (index < 0) throw new RepositoryError("not_found", "O registo não existe ou foi removido.");
      const removed = activities()[index];
      setActivities(activities().filter((item) => item.id !== id));
      return { activity: structuredClone(removed), index };
    },

    restore: async (activity, index) => {
      await sleep(latencyMs);
      const next = [...activities()];
      next.splice(index, 0, activity);
      setActivities(next);
      return structuredClone(activity);
    },

    tasks: async () => {
      await sleep(latencyMs);
      return structuredClone(tasks());
    },

    createTask: async (task) => {
      await sleep(latencyMs);
      setTasks([task, ...tasks()]);
      return structuredClone(task);
    },

    moveTaskStatus: async (id, status) => {
      await sleep(latencyMs);
      findTask(id);
      const next = tasks().map((item) => (item.id === id ? { ...item, status } : item));
      setTasks(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },

    postponeTask: async (id, dueDate) => {
      await sleep(latencyMs);
      findTask(id);
      const next = tasks().map((item) => (item.id === id ? { ...item, dueDate } : item));
      setTasks(next);
      return structuredClone(next.find((item) => item.id === id)!);
    },
  };
}
