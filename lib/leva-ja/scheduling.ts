import { ACTIVE_STATUSES } from "./status";
import type { ClaimKind, ClaimStatus, PhotoStage, ServiceRequest, ServiceStatus } from "@/types/leva-ja";

export const SCHEDULE_RISK_HOURS = 3;

export const PHOTO_STAGE_LABELS: Record<PhotoStage, string> = {
  pickup: "Recolha",
  delivery: "Entrega",
  damage: "Dano",
};

export const CLAIM_KIND_LABELS: Record<ClaimKind, string> = {
  cargo_damage: "Danos na carga",
  vehicle_damage: "Danos na viatura do cliente",
  accident: "Acidente de viação",
  theft: "Furto ou extravio",
  injury: "Ferimentos",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  reported: "Participado",
  under_review: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  paid: "Indemnizado",
};

export const CLAIM_STATUS_TONES = { reported: "warning", under_review: "info", approved: "success", rejected: "danger", paid: "neutral" } as const;

export const CLAIMABLE_STATUSES: readonly ServiceStatus[] = ["pickup_confirmed", "in_transit", "delivered", "paid", "rated"];

export function isUpcoming(request: Pick<ServiceRequest, "scheduledFor" | "status">, now: number, leadMinutes: number) {
  if (!request.scheduledFor || (request.status !== "searching" && request.status !== "assigned")) return false;
  return Date.parse(request.scheduledFor) - now > leadMinutes * 60_000;
}

export function scheduleRisk(request: Pick<ServiceRequest, "scheduledFor" | "status" | "providerId">, now: number) {
  if (!request.scheduledFor || request.providerId || request.status !== "searching") return false;
  return Date.parse(request.scheduledFor) - now < SCHEDULE_RISK_HOURS * 3_600_000;
}

export type SlaSample = { minutes: number; withinTarget: boolean };

export function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

export function slaStats(minutes: number[], target: number) {
  const within = minutes.filter((value) => value <= target).length;
  return {
    count: minutes.length,
    withinRate: minutes.length ? within / minutes.length : null,
    average: minutes.length ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : null,
    p90: percentile(minutes, 0.9),
    breaches: minutes.length - within,
  };
}

export function claimIssues(input: { description: string; estimatedAmount: number; occurredAt: string }, now: number) {
  const issues: { field: "description" | "estimatedAmount" | "occurredAt"; message: string }[] = [];
  if (input.description.trim().length < 10) issues.push({ field: "description", message: "Descreva o que aconteceu (pelo menos 10 caracteres)." });
  if (!Number.isInteger(input.estimatedAmount) || input.estimatedAmount <= 0) issues.push({ field: "estimatedAmount", message: "Indique o valor estimado do prejuízo." });
  const occurred = Date.parse(input.occurredAt);
  if (Number.isNaN(occurred) || occurred > now) issues.push({ field: "occurredAt", message: "Indique quando aconteceu (não pode ser no futuro)." });
  return issues;
}

export function dispatchStartsAt(request: Pick<ServiceRequest, "scheduledFor" | "createdAt">, leadMinutes: number) {
  const created = Date.parse(request.createdAt);
  if (!request.scheduledFor) return created;
  return Math.max(created, Date.parse(request.scheduledFor) - leadMinutes * 60_000);
}

export function isInProgress(request: Pick<ServiceRequest, "scheduledFor" | "status">, now: number, leadMinutes: number) {
  return ACTIVE_STATUSES.includes(request.status) && !isUpcoming(request, now, leadMinutes);
}
