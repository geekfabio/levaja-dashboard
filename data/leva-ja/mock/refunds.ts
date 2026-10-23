import { formatKz } from "@/lib/format";
import { committedRefunds, needsSecondApprover, refundableAmount, REFUND_STATUS_LABELS, validateRefund } from "@/lib/leva-ja/refunds";
import type { Refund, RefundSource } from "@/types/leva-ja";
import type { CreateRefundInput, RefundsRepository } from "../repositories/refunds";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, eventAt, syncRefundTransaction } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";
import type { StoredRequest } from "./state";

export function refundLabel(refund: Pick<Refund, "code" | "requestCode" | "amount">) {
  return `${refund.code} — ${refund.requestCode} · ${formatKz(refund.amount)}`;
}

export function createRefundRecord(
  db: MockDatabase,
  ctx: MockContext,
  request: StoredRequest,
  input: Omit<CreateRefundInput, "requestId">,
  source: RefundSource,
): Refund {
  const available = refundableAmount(request, ctx.state.refunds);
  const issues = validateRefund({
    amount: input.amount,
    reason: input.reason,
    available,
    paidAt: eventAt(request, "paid"),
    now: ctx.now,
    settings: ctx.state.settings.payouts,
  });
  if (issues.length) {
    throw new RepositoryError("validation", issues[0].message, issues.map((issue) => ({ field: issue.field, message: issue.message })));
  }
  const client = ctx.state.clients.find((item) => item.id === request.clientId);
  const provider = request.providerId ? ctx.state.providers.find((item) => item.id === request.providerId) : undefined;
  const sequence = ctx.state.refunds.reduce((max, refund) => Math.max(max, Number(refund.code.replace(/\D/g, "")) || 0), 1000) + 1;
  const refund: Refund = {
    id: db.nextId("rf"),
    code: `RE-${sequence}`,
    requestId: request.id,
    requestCode: request.code,
    clientId: request.clientId,
    clientName: client?.name ?? "Cliente",
    providerId: provider?.id,
    providerName: provider?.name,
    amount: input.amount,
    reason: input.reason.trim(),
    source,
    chargeProvider: Boolean(input.chargeProvider && provider),
    method: request.paymentMethod ?? "card",
    status: "pending",
    requestedAt: ctx.nowIso,
    requestedBy: ctx.session.user.name,
    requestedById: ctx.session.user.id,
  };
  ctx.state.refunds.unshift(refund);
  db.audit(ctx, "refund.request", { kind: "refund", id: refund.id, label: refundLabel(refund) }, refund.reason, [
    { field: "Valor", from: "—", to: formatKz(refund.amount) },
    { field: "Imputado ao prestador", from: "—", to: refund.chargeProvider ? "Sim" : "Não" },
  ]);
  return refund;
}

export function createMockRefunds(db: MockDatabase): RefundsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.refunds, id, "Reembolso");
  const transition = (refund: Refund, next: Refund["status"]) => ({
    field: "Estado",
    from: REFUND_STATUS_LABELS[refund.status],
    to: REFUND_STATUS_LABELS[next],
  });
  const viewers = { anyOf: ["refunds.request", "refunds.decide"] as ("refunds.request" | "refunds.decide")[] };

  return {
    list: (filters = {}) =>
      db.run(viewers, (ctx) =>
        paginate(
          ctx.state.refunds
            .filter((refund) => {
              if (filters.status?.length && !filters.status.includes(refund.status)) return false;
              if (filters.source?.length && !filters.source.includes(refund.source)) return false;
              return matchesQuery(filters.q, refund.code, refund.requestCode, refund.clientName, refund.providerName, refund.paymentReference);
            })
            .sort(byNewest((refund) => refund.requestedAt)),
          filters,
        ),
      ),

    summary: () =>
      db.run(viewers, (ctx) => {
        const since = new Date(ctx.now.getTime() - 30 * DAY).toISOString();
        const pending = ctx.state.refunds.filter((refund) => refund.status === "pending");
        return {
          pendingCount: pending.length,
          pendingAmount: pending.reduce((sum, refund) => sum + refund.amount, 0),
          approvedAmount: ctx.state.refunds.filter((refund) => refund.status === "approved").reduce((sum, refund) => sum + refund.amount, 0),
          paidLast30: ctx.state.refunds
            .filter((refund) => refund.status === "paid" && (refund.paidAt ?? "") >= since)
            .reduce((sum, refund) => sum + refund.amount, 0),
        };
      }),

    forRequest: (requestId) =>
      db.run(viewers, (ctx) => {
        const request = findOr404(ctx.state.requests, requestId, "Pedido");
        return {
          refunds: ctx.state.refunds.filter((refund) => refund.requestId === requestId).sort(byNewest((refund) => refund.requestedAt)),
          refundable: refundableAmount(request, ctx.state.refunds),
          paidAt: eventAt(request, "paid"),
        };
      }),

    create: (input) =>
      db.run({ permission: "refunds.request" }, (ctx) => {
        const request = findOr404(ctx.state.requests, input.requestId, "Pedido");
        const refund = createRefundRecord(db, ctx, request, input, "manual");
        db.commit("finance", "requests");
        return refund;
      }),

    approve: (id, reason) =>
      db.run({ permission: "refunds.decide" }, (ctx) => {
        const refund = find(ctx, id);
        if (refund.status !== "pending") {
          throw new RepositoryError("invalid_transition", `Só é possível aprovar um reembolso por aprovar (está «${REFUND_STATUS_LABELS[refund.status]}»).`);
        }
        if (needsSecondApprover(refund, ctx.state.settings.payouts) && refund.requestedById === ctx.session.user.id) {
          throw new RepositoryError(
            "forbidden",
            `Reembolsos acima de ${formatKz(ctx.state.settings.payouts.refundDualApprovalAbove)} têm de ser aprovados por outra pessoa.`,
          );
        }
        const request = findOr404(ctx.state.requests, refund.requestId, "Pedido");
        if (committedRefunds(ctx.state.refunds, request.id, refund.id) + refund.amount > request.price.total) {
          throw new RepositoryError("validation", "O total reembolsado passaria o valor pago pelo cliente.");
        }
        const change = transition(refund, "approved");
        refund.status = "approved";
        refund.decidedAt = ctx.nowIso;
        refund.decidedBy = ctx.session.user.name;
        refund.decisionReason = reason?.trim() || undefined;
        db.audit(ctx, "refund.approve", { kind: "refund", id: refund.id, label: refundLabel(refund) }, reason, [change]);
        db.commit("finance");
        return refund;
      }),

    reject: (id, reason) =>
      db.run({ permission: "refunds.decide" }, (ctx) => {
        const refund = find(ctx, id);
        if (refund.status !== "pending" && refund.status !== "approved") {
          throw new RepositoryError("invalid_transition", `Não é possível rejeitar um reembolso «${REFUND_STATUS_LABELS[refund.status]}».`);
        }
        const why = requireReason(reason, "o motivo da rejeição");
        const change = transition(refund, "rejected");
        refund.status = "rejected";
        refund.decidedAt = ctx.nowIso;
        refund.decidedBy = ctx.session.user.name;
        refund.decisionReason = why;
        db.audit(ctx, "refund.reject", { kind: "refund", id: refund.id, label: refundLabel(refund) }, why, [change]);
        db.commit("finance");
        return refund;
      }),

    markPaid: (id, paymentReference) =>
      db.run({ permission: "refunds.decide" }, (ctx) => {
        const refund = find(ctx, id);
        if (refund.status !== "approved") {
          throw new RepositoryError("invalid_transition", "Só é possível pagar um reembolso aprovado.");
        }
        const reference = paymentReference?.trim() ?? "";
        if (reference.length < 3) {
          throw new RepositoryError("validation", "Indique a referência da devolução.", [{ field: "paymentReference", message: "Indique a referência da devolução." }]);
        }
        const change = transition(refund, "paid");
        refund.status = "paid";
        refund.paidAt = ctx.nowIso;
        refund.paymentReference = reference;
        syncRefundTransaction(ctx.state, refund);
        db.audit(ctx, "refund.paid", { kind: "refund", id: refund.id, label: refundLabel(refund) }, `Referência ${reference}`, [change]);
        db.commit("finance", "providers");
        return refund;
      }),
  };
}
