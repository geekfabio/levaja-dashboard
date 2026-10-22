import type { ServiceStatus } from "@/types/leva-ja";

export const STATUS_FLOW: readonly ServiceStatus[] = [
  "searching",
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
  "rated",
];

export const ALL_STATUSES: readonly ServiceStatus[] = [...STATUS_FLOW, "cancelled"];

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  searching: "A procurar prestador",
  assigned: "Prestador atribuído",
  en_route: "A caminho",
  arrived: "No local",
  pickup_confirmed: "Recolha confirmada",
  in_transit: "Em transporte",
  delivered: "Entregue",
  paid: "Pago",
  rated: "Concluído",
  cancelled: "Cancelado",
};

export type StatusTone = "warning" | "info" | "success" | "danger" | "neutral";

export const STATUS_TONES: Record<ServiceStatus, StatusTone> = {
  searching: "warning",
  assigned: "info",
  en_route: "info",
  arrived: "info",
  pickup_confirmed: "info",
  in_transit: "info",
  delivered: "success",
  paid: "success",
  rated: "success",
  cancelled: "danger",
};

export const CANCELLABLE_STATUSES: readonly ServiceStatus[] = ["searching", "assigned", "en_route", "arrived"];

export const REASSIGNABLE_STATUSES: readonly ServiceStatus[] = ["searching", "assigned", "en_route", "arrived"];

export const DISPUTABLE_STATUSES: readonly ServiceStatus[] = [
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
  "rated",
];

export const FORCE_COMPLETE_STATUSES: readonly ServiceStatus[] = ["pickup_confirmed", "in_transit", "delivered", "paid"];

export const ACTIVE_STATUSES: readonly ServiceStatus[] = [
  "searching",
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
];

export const COMPLETED_STATUSES: readonly ServiceStatus[] = ["delivered", "paid", "rated"];

export function nextStatus(status: ServiceStatus): ServiceStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  if (index < 0 || index === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

export function canTransition(from: ServiceStatus, to: ServiceStatus) {
  if (to === "cancelled") return CANCELLABLE_STATUSES.includes(from);
  return nextStatus(from) === to;
}

export function canCancel(status: ServiceStatus) {
  return CANCELLABLE_STATUSES.includes(status);
}

export function canReassign(status: ServiceStatus) {
  return REASSIGNABLE_STATUSES.includes(status);
}

export function canDispute(status: ServiceStatus) {
  return DISPUTABLE_STATUSES.includes(status);
}

export function isActive(status: ServiceStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function isCompleted(status: ServiceStatus) {
  return COMPLETED_STATUSES.includes(status);
}

export function stepsUntil(from: ServiceStatus, to: ServiceStatus): ServiceStatus[] {
  const start = STATUS_FLOW.indexOf(from);
  const end = STATUS_FLOW.indexOf(to);
  if (start < 0 || end <= start) return [];
  return STATUS_FLOW.slice(start + 1, end + 1);
}
