import { formatKz } from "@/lib/format";
import { CLAIMABLE_STATUSES, CLAIM_KIND_LABELS, CLAIM_STATUS_LABELS, claimIssues } from "@/lib/leva-ja/scheduling";
import { STATUS_LABELS } from "@/lib/leva-ja/status";
import type { Claim, ClaimStatus } from "@/types/leva-ja";
import type { ClaimsRepository } from "../repositories/claims";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";

const OPEN: readonly ClaimStatus[] = ["reported", "under_review"];

export function createMockClaims(db: MockDatabase): ClaimsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.claims, id, "Sinistro");
  const label = (claim: Claim) => `${claim.code} — ${claim.requestCode} · ${CLAIM_KIND_LABELS[claim.kind]}`;
  const transition = (claim: Claim, next: ClaimStatus) => ({ field: "Estado", from: CLAIM_STATUS_LABELS[claim.status], to: CLAIM_STATUS_LABELS[next] });
  const viewers = { permission: "claims.view" as const };
  const managers = { permission: "claims.manage" as const };

  return {
    list: (filters = {}) =>
      db.run(viewers, ({ state }) =>
        paginate(
          state.claims
            .filter((claim) => {
              if (filters.status?.length && !filters.status.includes(claim.status)) return false;
              if (filters.kind?.length && !filters.kind.includes(claim.kind)) return false;
              return matchesQuery(filters.q, claim.code, claim.requestCode, claim.clientName, claim.providerName, claim.insurer);
            })
            .sort(byNewest((claim) => claim.reportedAt)),
          filters,
        ),
      ),

    summary: () =>
      db.run(viewers, ({ state, now }) => {
        const since = new Date(now.getTime() - 90 * DAY).toISOString();
        const open = state.claims.filter((claim) => OPEN.includes(claim.status));
        return {
          open: open.length,
          underReview: state.claims.filter((claim) => claim.status === "under_review").length,
          openEstimated: open.reduce((sum, claim) => sum + claim.estimatedAmount, 0),
          paidLast90: state.claims.filter((claim) => claim.status === "paid" && (claim.paidAt ?? "") >= since).reduce((sum, claim) => sum + (claim.approvedAmount ?? 0), 0),
        };
      }),

    get: (id) => db.run(viewers, (ctx) => find(ctx, id)),

    forRequest: (requestId) => db.run(viewers, ({ state }) => state.claims.filter((claim) => claim.requestId === requestId).sort(byNewest((claim) => claim.reportedAt))),

    report: (input) =>
      db.run(viewers, (ctx) => {
        const request = findOr404(ctx.state.requests, input.requestId, "Pedido");
        if (!CLAIMABLE_STATUSES.includes(request.status)) {
          throw new RepositoryError("invalid_transition", `Só é possível participar um sinistro depois da recolha (o pedido está «${STATUS_LABELS[request.status]}»).`);
        }
        if (!(input.kind in CLAIM_KIND_LABELS)) throw new RepositoryError("validation", "Escolha o tipo de sinistro.");
        const issues = claimIssues(input, ctx.now.getTime());
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const client = ctx.state.clients.find((item) => item.id === request.clientId);
        const provider = request.providerId ? ctx.state.providers.find((item) => item.id === request.providerId) : undefined;
        const sequence = ctx.state.claims.reduce((max, claim) => Math.max(max, Number(claim.code.replace(/\D/g, "")) || 0), 1000) + 1;
        const claim: Claim = {
          id: db.nextId("sn"),
          code: `SN-${sequence}`,
          requestId: request.id,
          requestCode: request.code,
          clientId: request.clientId,
          clientName: client?.name ?? "Cliente",
          providerId: provider?.id,
          providerName: provider?.name,
          kind: input.kind,
          description: input.description.trim(),
          occurredAt: new Date(input.occurredAt).toISOString(),
          reportedAt: ctx.nowIso,
          reportedBy: ctx.session.user.name,
          estimatedAmount: input.estimatedAmount,
          status: "reported",
          notes: [],
          photoIds: (request.photos ?? []).filter((photo) => photo.stage === "damage").map((photo) => photo.id),
        };
        ctx.state.claims.unshift(claim);
        db.audit(ctx, "claim.report", { kind: "claim", id: claim.id, label: label(claim) }, claim.description, [
          { field: "Valor estimado", from: "—", to: formatKz(claim.estimatedAmount) },
        ]);
        db.commit("requests", "support");
        return claim;
      }),

    startReview: (id, insurer, policyNumber) =>
      db.run(managers, (ctx) => {
        const claim = find(ctx, id);
        if (claim.status !== "reported") throw new RepositoryError("invalid_transition", "Só um sinistro participado pode entrar em análise.");
        const company = requireReason(insurer, "a seguradora");
        const policy = requireReason(policyNumber, "o número da apólice");
        const change = transition(claim, "under_review");
        claim.status = "under_review";
        claim.insurer = company;
        claim.policyNumber = policy;
        db.audit(ctx, "claim.review", { kind: "claim", id, label: label(claim) }, `${company} · apólice ${policy}`, [change]);
        db.commit("support");
        return claim;
      }),

    addNote: (id, text) =>
      db.run(viewers, (ctx) => {
        const claim = find(ctx, id);
        if (!OPEN.includes(claim.status)) throw new RepositoryError("invalid_transition", "O sinistro já está fechado.");
        const note = requireReason(text, "o texto da nota");
        claim.notes.push({ id: db.nextId("sno"), author: ctx.session.user.name, text: note, at: ctx.nowIso });
        db.audit(ctx, "claim.note", { kind: "claim", id, label: label(claim) }, note);
        db.commit("support");
        return claim;
      }),

    approve: (id, amount, reason) =>
      db.run(managers, (ctx) => {
        const claim = find(ctx, id);
        if (claim.status !== "under_review") throw new RepositoryError("invalid_transition", "Só é possível aprovar um sinistro em análise.");
        if (!Number.isInteger(amount) || amount <= 0) throw new RepositoryError("validation", "Indique o valor da indemnização.", [{ field: "amount", message: "Indique o valor." }]);
        if (amount > claim.estimatedAmount * 1.5) {
          throw new RepositoryError("validation", `O valor passa 150 % do estimado (${formatKz(claim.estimatedAmount)}). Actualize a estimativa primeiro.`, [
            { field: "amount", message: "Valor demasiado alto face ao estimado." },
          ]);
        }
        const why = requireReason(reason, "a justificação");
        const change = transition(claim, "approved");
        claim.status = "approved";
        claim.approvedAmount = amount;
        claim.decisionReason = why;
        claim.decidedAt = ctx.nowIso;
        claim.decidedBy = ctx.session.user.name;
        db.audit(ctx, "claim.approve", { kind: "claim", id, label: label(claim) }, why, [change, { field: "Indemnização", from: "—", to: formatKz(amount) }]);
        db.commit("support", "finance");
        return claim;
      }),

    reject: (id, reason) =>
      db.run(managers, (ctx) => {
        const claim = find(ctx, id);
        if (!OPEN.includes(claim.status)) throw new RepositoryError("invalid_transition", "O sinistro já foi decidido.");
        const why = requireReason(reason, "o motivo da recusa");
        const change = transition(claim, "rejected");
        claim.status = "rejected";
        claim.decisionReason = why;
        claim.decidedAt = ctx.nowIso;
        claim.decidedBy = ctx.session.user.name;
        db.audit(ctx, "claim.reject", { kind: "claim", id, label: label(claim) }, why, [change]);
        db.commit("support");
        return claim;
      }),

    markPaid: (id, paymentReference) =>
      db.run(managers, (ctx) => {
        const claim = find(ctx, id);
        if (claim.status !== "approved") throw new RepositoryError("invalid_transition", "Só é possível pagar um sinistro aprovado.");
        const reference = requireReason(paymentReference, "a referência do pagamento");
        const change = transition(claim, "paid");
        claim.status = "paid";
        claim.paidAt = ctx.nowIso;
        claim.paymentReference = reference;
        db.audit(ctx, "claim.paid", { kind: "claim", id, label: label(claim) }, `Referência ${reference}`, [change]);
        db.commit("support", "finance");
        return claim;
      }),
  };
}
