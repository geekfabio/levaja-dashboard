import type {
  DisputeCategory,
  DisputeOutcome,
  PayoutSettings,
  Refund,
  RefundSource,
  RefundStatus,
  ServiceRequest,
} from "@/types/leva-ja";

export const DISPUTE_TARGET_HOURS = 72;

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  damage: "Danos na carga ou viatura",
  payment: "Pagamento",
  price: "Valor cobrado",
  no_show: "Não compareceu",
  delay: "Atraso",
  conduct: "Comportamento",
  other: "Outro",
};

export const DISPUTE_CATEGORIES = Object.keys(DISPUTE_CATEGORY_LABELS) as DisputeCategory[];

export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  no_refund: "Sem reembolso",
  refund_full: "Reembolso total",
  refund_partial: "Reembolso parcial",
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: "Por aprovar",
  approved: "Aprovado",
  rejected: "Rejeitado",
  paid: "Pago",
};

export const REFUND_STATUS_TONES = { pending: "warning", approved: "info", rejected: "danger", paid: "success" } as const;

export const REFUND_SOURCE_LABELS: Record<RefundSource, string> = {
  dispute: "Disputa",
  cancellation: "Cancelamento",
  manual: "Pedido manual",
};

const REFUNDABLE_STATUSES: readonly ServiceRequest["status"][] = ["paid", "rated"];

export function isRefundable(request: Pick<ServiceRequest, "status">) {
  return REFUNDABLE_STATUSES.includes(request.status);
}

type RefundLike = Pick<Refund, "id" | "requestId" | "status" | "amount">;

export function committedRefunds(refunds: RefundLike[], requestId: string, exceptId?: string) {
  return refunds
    .filter((refund) => refund.requestId === requestId && refund.status !== "rejected" && refund.id !== exceptId)
    .reduce((sum, refund) => sum + refund.amount, 0);
}

export function refundableAmount(request: Pick<ServiceRequest, "id" | "status" | "price">, refunds: RefundLike[]) {
  if (!isRefundable(request)) return 0;
  return Math.max(0, request.price.total - committedRefunds(refunds, request.id));
}

export type RefundIssue = { field: "amount" | "reason" | "request"; message: string };

export function validateRefund(input: { amount: number; reason: string; available: number; paidAt?: string; now: Date; settings: Pick<PayoutSettings, "refundWindowDays"> }): RefundIssue[] {
  const issues: RefundIssue[] = [];
  if (input.available <= 0) issues.push({ field: "request", message: "Este pedido não tem valor por reembolsar." });
  if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount) || input.amount <= 0) {
    issues.push({ field: "amount", message: "Indique um valor inteiro maior que zero." });
  } else if (input.amount > input.available) {
    issues.push({ field: "amount", message: "O valor não pode passar o que falta reembolsar." });
  }
  if (input.reason.trim().length < 3) issues.push({ field: "reason", message: "Indique o motivo do reembolso." });
  if (input.paidAt) {
    const limit = new Date(input.paidAt).getTime() + input.settings.refundWindowDays * 86_400_000;
    if (input.now.getTime() > limit) {
      issues.push({ field: "request", message: `O prazo de ${input.settings.refundWindowDays} dias para pedir reembolso já passou.` });
    }
  }
  return issues;
}

export function needsSecondApprover(refund: Pick<Refund, "amount">, settings: Pick<PayoutSettings, "refundDualApprovalAbove">) {
  return refund.amount > settings.refundDualApprovalAbove;
}

export function disputeAgeHours(openedAt: string, now: number) {
  return Math.max(0, (now - new Date(openedAt).getTime()) / 3_600_000);
}

export function isDisputeOverdue(dispute: { openedAt: string; resolvedAt?: string }, now: number) {
  return !dispute.resolvedAt && disputeAgeHours(dispute.openedAt, now) > DISPUTE_TARGET_HOURS;
}
