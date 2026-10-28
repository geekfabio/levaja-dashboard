"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { repositories } from "@/data/crm";
import type { Automation, AutomationStatus } from "@/data/automations";
import { recordEvent } from "@/stores/audit-store";
import { useAutomationsStore } from "@/stores/automations-store";

const KEY = ["crm", "automations"] as const;

function invalidate(client: QueryClient) {
  return client.invalidateQueries({ queryKey: KEY });
}

export function useAutomations() {
  return useQuery({ queryKey: KEY, queryFn: () => repositories().automations.list() });
}

export async function createAutomation() {
  const automation = await repositories().automations.create();
  useAutomationsStore.setState({ editorId: automation.id });
  return automation;
}

export function useCreateAutomation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAutomation,
    onSuccess: () => invalidate(client),
  });
}

export function useRemoveAutomation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories().automations.remove(id),
    onSuccess: (automation) => {
      invalidate(client);
      if (useAutomationsStore.getState().editorId === automation.id) {
        useAutomationsStore.setState({ editorId: null });
      }
    },
  });
}

export function useSetAutomationStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AutomationStatus; previousStatus: AutomationStatus }) =>
      repositories().automations.setStatus(id, status),
    onSuccess: (automation, { status, previousStatus }) => {
      invalidate(client);
      if (previousStatus === status) return;
      recordEvent({
        action: status === "Ativa" ? "ativou a automação" : "pausou a automação",
        target: { module: "Automações", id: automation.id, label: automation.name },
        sensitive: status === "Ativa",
        changes: [{ field: "Estado", from: previousStatus, to: status }],
        toast: {
          title: status === "Ativa" ? "Automação ativada" : "Automação pausada",
          description: automation.name,
          tone: "success",
        },
      });
    },
  });
}

export type { Automation };
