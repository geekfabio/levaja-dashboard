export const SERVICE_REQUEST_STATUS_FLOW = [
  "searching",
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
  "rated",
] as const;

export type FlowStatus = (typeof SERVICE_REQUEST_STATUS_FLOW)[number];
export type ServiceRequestStatus = FlowStatus | "cancelled";

export type RequestActor = "client" | "provider" | "system";

const CANCELLABLE_STATUSES: ServiceRequestStatus[] = ["searching", "assigned", "en_route", "arrived"];

export const ACTIVE_REQUEST_STATUSES: readonly ServiceRequestStatus[] = [
  "searching",
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
];

export const PROVIDER_BUSY_STATUSES: readonly ServiceRequestStatus[] = [
  "assigned",
  "en_route",
  "arrived",
  "pickup_confirmed",
  "in_transit",
];

export const REASSIGNABLE_REQUEST_STATUSES: readonly ServiceRequestStatus[] = CANCELLABLE_STATUSES;

export const DISPUTABLE_REQUEST_STATUSES: readonly ServiceRequestStatus[] = [
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
  "rated",
];

export const FORCE_COMPLETE_REQUEST_STATUSES: readonly ServiceRequestStatus[] = [
  "pickup_confirmed",
  "in_transit",
  "delivered",
  "paid",
];

export const TRANSITION_ACTOR: Partial<Record<ServiceRequestStatus, Exclude<RequestActor, "system">>> = {
  assigned: "provider",
  en_route: "provider",
  arrived: "provider",
  pickup_confirmed: "client",
  in_transit: "provider",
  delivered: "provider",
  paid: "client",
  rated: "client",
};

export function nextStatus(status: ServiceRequestStatus): ServiceRequestStatus | undefined {
  const index = SERVICE_REQUEST_STATUS_FLOW.indexOf(status as FlowStatus);
  return index >= 0 ? SERVICE_REQUEST_STATUS_FLOW[index + 1] : undefined;
}

export function canTransition(from: ServiceRequestStatus, to: ServiceRequestStatus) {
  if (to === "cancelled") return CANCELLABLE_STATUSES.includes(from);
  return nextStatus(from) === to;
}

export const isCancellable = (status: ServiceRequestStatus) => CANCELLABLE_STATUSES.includes(status);

export const isReassignable = (status: ServiceRequestStatus) => REASSIGNABLE_REQUEST_STATUSES.includes(status);

export const canOpenDispute = (status: ServiceRequestStatus) => DISPUTABLE_REQUEST_STATUSES.includes(status);

export const isForceCompletable = (status: ServiceRequestStatus) => FORCE_COMPLETE_REQUEST_STATUSES.includes(status);

export function stepsUntil(from: ServiceRequestStatus, to: FlowStatus): FlowStatus[] {
  const start = SERVICE_REQUEST_STATUS_FLOW.indexOf(from as FlowStatus);
  const end = SERVICE_REQUEST_STATUS_FLOW.indexOf(to);
  if (start < 0 || end <= start) return [];
  return SERVICE_REQUEST_STATUS_FLOW.slice(start + 1, end + 1);
}
