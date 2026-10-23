"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { AccessLogFilters, PrivacyFilters, WebhookInput } from "@/data/leva-ja";
import { PRIVACY_KIND_LABELS } from "@/lib/leva-ja/trust";
import { useAdminMutation } from "./use-admin-mutation";

export function usePrivacyRequests(filters: PrivacyFilters) {
  return useQuery({
    queryKey: ["admin", "privacy", "list", filters],
    queryFn: () => repositories().privacy.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePrivacySummary() {
  return useQuery({
    queryKey: ["admin", "privacy", "summary"],
    queryFn: () => repositories().privacy.summary(),
  });
}

export function usePrivacyRequest(id: string | null) {
  return useQuery({
    queryKey: ["admin", "privacy", "detail", id],
    queryFn: () => repositories().privacy.get(id ?? ""),
    enabled: id !== null,
  });
}

export function useStartPrivacyRequest() {
  return useAdminMutation((id: string) => repositories().privacy.start(id), {
    success: (request) => `${request.code} em tratamento`,
    description: (request) => PRIVACY_KIND_LABELS[request.kind],
  });
}

export function useCompletePrivacyRequest() {
  return useAdminMutation(({ id, resolution }: { id: string; resolution: string }) => repositories().privacy.complete(id, resolution), {
    success: (request) => `${request.code} concluído`,
    description: (request) => request.subjectName,
  });
}

export function useRejectPrivacyRequest() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().privacy.reject(id, reason), {
    success: (request) => `${request.code} recusado`,
  });
}

export function useExportPrivacyData() {
  return useAdminMutation((id: string) => repositories().privacy.exportData(id), {
    success: "Exportação preparada",
    description: (result) => result.subject,
  });
}

export function useAdminSessions(enabled = true) {
  return useQuery({
    queryKey: ["admin", "security", "sessions"],
    queryFn: () => repositories().security.sessions(),
    enabled,
  });
}

export function useRevokeSession() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().security.revokeSession(id, reason), {
    success: "Sessão terminada",
    description: "O utilizador tem de voltar a entrar.",
  });
}

export function useAccessLog(filters: AccessLogFilters, enabled = true) {
  return useQuery({
    queryKey: ["admin", "security", "access-log", filters],
    queryFn: () => repositories().security.accessLog(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSetTwoFactor() {
  return useAdminMutation(({ userId, enabled, reason }: { userId: string; enabled: boolean; reason: string }) => repositories().security.setTwoFactor(userId, enabled, reason), {
    success: (user) => (user.twoFactorEnabled ? "Segundo factor activado" : "Segundo factor desactivado"),
    description: (user) => user.name,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ["admin", "integrations", "keys"],
    queryFn: () => repositories().integrations.keys(),
  });
}

export function useCreateApiKey() {
  return useAdminMutation(({ name, scopes, expiresInDays }: { name: string; scopes: string[]; expiresInDays: number | null }) => repositories().integrations.createKey(name, scopes, expiresInDays), {
    success: (result) => `Chave ${result.item.name} criada`,
    description: "Copie a chave agora: não volta a ser mostrada.",
  });
}

export function useRevokeApiKey() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().integrations.revokeKey(id, reason), {
    success: (key) => `Chave ${key.name} revogada`,
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ["admin", "integrations", "webhooks"],
    queryFn: () => repositories().integrations.webhooks(),
  });
}

export function useCreateWebhook() {
  return useAdminMutation((input: WebhookInput) => repositories().integrations.createWebhook(input), {
    success: "Webhook criado",
    description: "Copie o segredo agora: não volta a ser mostrado.",
  });
}

export function useSetWebhookActive() {
  return useAdminMutation(({ id, active }: { id: string; active: boolean }) => repositories().integrations.setWebhookActive(id, active), {
    success: (webhook) => (webhook.active ? "Webhook activado" : "Webhook desactivado"),
    description: (webhook) => webhook.url,
  });
}

export function useTestWebhook() {
  return useAdminMutation((id: string) => repositories().integrations.testWebhook(id), {
    success: (delivery) => (delivery.status === 200 ? "Teste simulado com sucesso" : "Teste simulado com falha"),
    description: "Nenhum pedido foi enviado para o endereço: é uma simulação.",
  });
}
