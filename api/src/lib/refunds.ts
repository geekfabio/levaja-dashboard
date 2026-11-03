export const REFUND_WINDOW_DAYS = 30;
export const REFUND_DUAL_APPROVAL_ABOVE_KZ = 20000;
export const DISPUTE_TARGET_HOURS = 72;

const REFUNDABLE_REQUEST_STATUSES = new Set(["paid", "rated"]);

export function isRefundableStatus(status: string) {
  return REFUNDABLE_REQUEST_STATUSES.has(status);
}

export type RefundLike = { id: string; requestId: string; status: string; amountKz: number };

export function committedRefundsKz(refunds: RefundLike[], requestId: string, exceptId?: string) {
  return refunds
    .filter((refund) => refund.requestId === requestId && refund.status !== "rejected" && refund.id !== exceptId)
    .reduce((sum, refund) => sum + refund.amountKz, 0);
}

export function refundableAmountKz(request: { status: string; totalKz: number }, refunds: RefundLike[], requestId: string) {
  if (!isRefundableStatus(request.status)) return 0;
  return Math.max(0, request.totalKz - committedRefundsKz(refunds, requestId));
}

export function needsSecondApprover(amountKz: number) {
  return amountKz > REFUND_DUAL_APPROVAL_ABOVE_KZ;
}

export function disputeAgeHours(openedAt: Date, now: Date) {
  return Math.max(0, (now.getTime() - openedAt.getTime()) / 3_600_000);
}

export function isDisputeOverdue(dispute: { openedAt: Date; resolvedAt: Date | null }, now: Date) {
  return !dispute.resolvedAt && disputeAgeHours(dispute.openedAt, now) > DISPUTE_TARGET_HOURS;
}
