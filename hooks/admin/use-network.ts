"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import type { ApplicationFilters, FleetFilters, FleetInput, PenaltyFilters, PenaltyInput, QualityFilters } from "@/data/leva-ja";
import { formatKz } from "@/lib/format";
import { APPLICATION_STAGE_LABELS, PENALTY_KIND_LABELS } from "@/lib/leva-ja/quality";
import type { Fleet, Penalty, ProviderApplication, ProviderDocument } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

const describeApplication = (application: ProviderApplication) => `${application.code} · ${APPLICATION_STAGE_LABELS[application.stage]}`;
const describePenalty = (penalty: Penalty) =>
  `${penalty.providerName} · ${PENALTY_KIND_LABELS[penalty.kind]}${penalty.amount ? ` · ${formatKz(penalty.amount)}` : ""}${penalty.days ? ` · ${penalty.days} dias` : ""}`;

export function useApplications(filters: ApplicationFilters) {
  return useQuery({ queryKey: ["admin", "applications", "list", filters], queryFn: () => repositories().applications.list(filters), placeholderData: keepPreviousData });
}

export function useApplication(id: string | null) {
  return useQuery({ queryKey: ["admin", "applications", "detail", id], queryFn: () => repositories().applications.get(id ?? ""), enabled: id !== null });
}

export function useApplicationSummary() {
  return useQuery({ queryKey: ["admin", "applications", "summary"], queryFn: () => repositories().applications.summary() });
}

export function useReceiveApplicationDocument() {
  return useAdminMutation(({ id, icon }: { id: string; icon: ProviderDocument["icon"] }) => repositories().applications.receiveDocument(id, icon), {
    success: "Documento recebido",
    description: describeApplication,
  });
}

export function useScheduleInterview() {
  return useAdminMutation(({ id, at }: { id: string; at: string }) => repositories().applications.scheduleInterview(id, at), {
    success: "Entrevista marcada",
    description: describeApplication,
  });
}

export function useRecordInspection() {
  return useAdminMutation(({ id, passed, notes }: { id: string; passed: boolean; notes: string }) => repositories().applications.recordInspection(id, passed, notes), {
    success: "Vistoria registada",
    description: describeApplication,
  });
}

export function useAdvanceApplication() {
  return useAdminMutation(({ id, note }: { id: string; note?: string }) => repositories().applications.advance(id, note), {
    success: "Candidatura avançou",
    description: describeApplication,
  });
}

export function useApproveApplication() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().applications.approve(id, reason), {
    success: "Candidatura aprovada",
    description: "O prestador foi criado; valide os documentos para o activar.",
  });
}

export function useRejectApplication() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().applications.reject(id, reason), {
    success: "Candidatura recusada",
    description: describeApplication,
  });
}

export function useFleets(filters: FleetFilters, enabled = true) {
  return useQuery({ queryKey: ["admin", "fleets", "list", filters], queryFn: () => repositories().fleets.list(filters), placeholderData: keepPreviousData, enabled });
}

export function useFleet(id: string | null) {
  return useQuery({ queryKey: ["admin", "fleets", "detail", id], queryFn: () => repositories().fleets.get(id ?? ""), enabled: id !== null });
}

export function useCreateFleet() {
  return useAdminMutation((input: FleetInput) => repositories().fleets.create(input), { success: (fleet: Fleet) => `Frota ${fleet.name} criada` });
}

export function useAddFleetDriver() {
  return useAdminMutation(({ id, providerId }: { id: string; providerId: string }) => repositories().fleets.addDriver(id, providerId), {
    success: "Motorista acrescentado",
    description: (fleet) => fleet.name,
  });
}

export function useRemoveFleetDriver() {
  return useAdminMutation(({ id, providerId, reason }: { id: string; providerId: string; reason: string }) => repositories().fleets.removeDriver(id, providerId, reason), {
    success: "Motorista retirado",
    description: (fleet) => fleet.name,
  });
}

export function useSetFleetStatus() {
  return useAdminMutation(({ id, status, reason }: { id: string; status: Fleet["status"]; reason: string }) => repositories().fleets.setStatus(id, status, reason), {
    success: (fleet) => (fleet.status === "suspended" ? `Frota ${fleet.name} suspensa` : `Frota ${fleet.name} reactivada`),
  });
}

export function useQualityScores(filters: QualityFilters) {
  return useQuery({ queryKey: ["admin", "quality", "scores", filters], queryFn: () => repositories().quality.scores(filters), placeholderData: keepPreviousData });
}

export function useProviderQuality(providerId: string) {
  return useQuery({ queryKey: ["admin", "quality", "provider", providerId], queryFn: () => repositories().quality.provider(providerId) });
}

export function usePenalties(filters: PenaltyFilters) {
  return useQuery({ queryKey: ["admin", "quality", "penalties", filters], queryFn: () => repositories().quality.penalties(filters), placeholderData: keepPreviousData });
}

export function usePenalize() {
  return useAdminMutation(({ providerId, input }: { providerId: string; input: PenaltyInput }) => repositories().quality.penalize(providerId, input), {
    success: "Penalização aplicada",
    description: describePenalty,
  });
}

export function useRevokePenalty() {
  return useAdminMutation(({ id, reason }: { id: string; reason: string }) => repositories().quality.revoke(id, reason), {
    success: "Penalização anulada",
    description: describePenalty,
  });
}
