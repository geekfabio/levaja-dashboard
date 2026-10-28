"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { Activity, ActivityType } from "@/data/activities";
import type { Task, TaskStatus } from "@/data/tasks";
import { diffRecord } from "@/lib/audit";
import { formatDateShort } from "@/lib/format";
import { CURRENT_USER } from "@/data/companies";
import { recordEvent } from "@/stores/audit-store";

const ACTIVITIES_KEY = ["crm", "activities"] as const;
const TASKS_KEY = ["crm", "tasks"] as const;

const ACTIVITY_LABELS: Partial<Record<keyof Activity, string>> = {
  type: "Tipo",
  companyName: "Cliente",
  contactName: "Contacto",
  owner: "Gestor",
  zone: "Zona",
  date: "Data",
  note: "Nota",
};

const ACTIVITY_PHRASES: Record<ActivityType, string> = {
  Visita: "registou uma visita a",
  Chamada: "registou uma chamada com",
  "E-mail": "registou um e-mail para",
  Reunião: "registou uma reunião com",
  Entrega: "registou uma entrega a",
  Reclamação: "registou uma reclamação de",
  WhatsApp: "registou uma conversa por WhatsApp com",
};

function invalidateActivities(client: QueryClient) {
  return client.invalidateQueries({ queryKey: ACTIVITIES_KEY });
}

function invalidateTasks(client: QueryClient) {
  return client.invalidateQueries({ queryKey: TASKS_KEY });
}

export function useActivities() {
  return useQuery({ queryKey: ACTIVITIES_KEY, queryFn: () => repositories().activities.list() });
}

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => repositories().activities.tasks() });
}

export function useCreateActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (activity: Activity) => repositories().activities.create(activity),
    onSuccess: ({ activity, offline }) => {
      invalidateActivities(client);
      recordEvent({
        action: ACTIVITY_PHRASES[activity.type],
        target: { module: "Atividades", id: activity.id, label: activity.companyName },
        companyId: activity.companyId,
        toast: {
          title: offline ? "Guardado sem rede" : "Atividade registada",
          description: offline
            ? `${activity.type} · ${activity.companyName}. Fica neste dispositivo e é enviado quando a rede voltar.`
            : `${activity.type} · ${activity.companyName}`,
          tone: "success",
        },
      });
    },
  });
}

export function useUpdateActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Activity, "id">>; previous: Activity }) => repositories().activities.update(id, patch),
    onSuccess: (next, { previous }) => {
      invalidateActivities(client);
      const changes = diffRecord(previous, next, ACTIVITY_LABELS, { date: (value: string) => formatDateShort(value) });
      if (changes.length === 0) return;
      recordEvent({
        action: "atualizou o registo de atividade de",
        target: { module: "Atividades", id: next.id, label: next.companyName },
        companyId: next.companyId,
        notify: false,
        changes,
        toast: {
          title: "Registo atualizado",
          description: `${next.type} · ${next.companyName}`,
          tone: "success",
          action: { label: "Anular", run: () => repositories().activities.update(next.id, previous).then(() => invalidateActivities(client)) },
        },
      });
    },
  });
}

export function useRemoveActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().activities.remove(id),
    onSuccess: ({ activity, index }) => {
      invalidateActivities(client);
      recordEvent({
        action: "eliminou o registo de atividade de",
        target: { module: "Atividades", label: activity.companyName },
        companyId: activity.companyId,
        notify: false,
        changes: [{ field: activity.type, from: activity.note }],
        toast: {
          title: "Registo eliminado",
          description: `${activity.type} · ${activity.companyName}`,
          action: { label: "Anular", run: () => repositories().activities.restore(activity, index).then(() => invalidateActivities(client)) },
        },
      });
    },
  });
}

export function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => repositories().activities.createTask(task),
    onSuccess: (task) => {
      invalidateTasks(client);
      recordEvent({
        action: "criou a tarefa",
        target: { module: "Atividades", id: task.id, label: task.title },
        notify: task.assignee === CURRENT_USER.name ? false : "update",
        changes: [{ field: "Responsável", to: task.assignee }],
        toast: { title: "Tarefa criada", description: task.title, tone: "success" },
      });
    },
  });
}

export function useMoveTaskStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus; from: TaskStatus; title: string }) => repositories().activities.moveTaskStatus(id, status),
    onSuccess: (task, { from, title }) => {
      invalidateTasks(client);
      if (task.status === from) return;
      recordEvent({
        action: task.status === "Feita" ? "concluiu a tarefa" : "alterou o estado da tarefa",
        target: { module: "Atividades", id: task.id, label: title },
        notify: false,
        changes: [{ field: "Estado", from, to: task.status }],
      });
    },
  });
}

export function usePostponeTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string; previousDueDate: string; title: string }) => repositories().activities.postponeTask(id, dueDate),
    onSuccess: (task, { previousDueDate, title }) => {
      invalidateTasks(client);
      recordEvent({
        action: "adiou a tarefa",
        target: { module: "Atividades", id: task.id, label: title },
        notify: false,
        changes: [{ field: "Prazo", from: formatDateShort(previousDueDate), to: formatDateShort(task.dueDate) }],
        toast: {
          title: "Tarefa adiada",
          description: `${title} · ${formatDateShort(task.dueDate)}`,
          action: { label: "Anular", run: () => repositories().activities.postponeTask(task.id, previousDueDate).then(() => invalidateTasks(client)) },
        },
      });
    },
  });
}
