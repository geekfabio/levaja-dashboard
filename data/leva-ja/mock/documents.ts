import { DOCUMENT_STATE_LABELS } from "@/lib/leva-ja/services";
import { formatDateNumeric } from "@/lib/format";
import type { ProviderAccount, ProviderDocument } from "@/types/leva-ja";
import type { DocumentReviewItem, DocumentsRepository } from "../repositories/documents";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { addDays } from "./domain";
import { matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

function toItem(state: MockState, provider: ProviderAccount, document: ProviderDocument): DocumentReviewItem {
  return {
    document,
    providerId: provider.id,
    providerName: provider.name,
    providerInitials: provider.initials,
    vehiclePlate: provider.vehicle.plate,
    submittedAt: state.documentSubmittedAt[document.id] ?? provider.joinedAt,
  };
}

export function allDocuments(state: MockState) {
  return state.providers.flatMap((provider) => provider.documents.map((document) => toItem(state, provider, document)));
}

export function reviewQueue(state: MockState) {
  return allDocuments(state)
    .filter((item) => item.document.state === "pending" || item.document.state === "needs_update")
    .sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1));
}

function locate(ctx: MockContext, documentId: string) {
  for (const provider of ctx.state.providers) {
    const document = provider.documents.find((item) => item.id === documentId);
    if (document) return { provider, document };
  }
  throw new RepositoryError("not_found", "Documento não encontrado.");
}

export function createMockDocuments(db: MockDatabase): DocumentsRepository {
  return {
    queue: (filters = {}) =>
      db.run({ permission: "documents.review" }, ({ state }) => {
        const states = filters.state?.length ? filters.state : ["pending", "needs_update"];
        const items = allDocuments(state)
          .filter((item) => states.includes(item.document.state))
          .filter((item) => matchesQuery(filters.q, item.providerName, item.vehiclePlate, item.document.title))
          .sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1));
        return paginate(items, filters);
      }),

    expiring: (withinDays) =>
      db.run({ permission: "documents.review" }, ({ state, today }) => {
        const limit = addDays(today, withinDays ?? state.settings.documents.expiryWarningDays);
        return allDocuments(state)
          .filter((item) => item.document.state === "verified" && item.document.validUntil >= today && item.document.validUntil <= limit)
          .sort((a, b) => (a.document.validUntil < b.document.validUntil ? -1 : 1));
      }),

    approve: (documentId, validUntil) =>
      db.run({ permission: "documents.review" }, (ctx) => {
        const { provider, document } = locate(ctx, documentId);
        const day = validUntil?.slice(0, 10) ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day <= ctx.today) {
          throw new RepositoryError("validation", "A validade tem de ser uma data futura.", [
            { field: "validUntil", message: "A validade tem de ser uma data futura." },
          ]);
        }
        const minimumDays = ctx.state.settings.documents.requirements.find((item) => item.icon === document.icon)?.minValidityDays ?? 0;
        if (day < addDays(ctx.today, minimumDays)) {
          throw new RepositoryError("validation", `Este documento tem de ser válido por pelo menos ${minimumDays} dias.`, [
            { field: "validUntil", message: `Este documento tem de ser válido por pelo menos ${minimumDays} dias.` },
          ]);
        }
        if (document.state === "verified" && document.validUntil === day) {
          throw new RepositoryError("invalid_transition", "Este documento já está verificado.");
        }
        const from = document.state;
        const fromValidity = document.validUntil;
        document.state = "verified";
        document.validUntil = day;
        db.audit(ctx, "document.approve", { kind: "document", id: document.id, label: `${document.title} — ${provider.name}` }, "Documento aprovado.", [
          { field: "Estado", from: DOCUMENT_STATE_LABELS[from], to: DOCUMENT_STATE_LABELS.verified },
          { field: "Validade", from: formatDateNumeric(fromValidity), to: formatDateNumeric(day) },
        ]);
        db.commit("documents", "providers");
        return toItem(ctx.state, provider, document);
      }),

    reject: (documentId, reason) =>
      db.run({ permission: "documents.review" }, (ctx) => {
        const { provider, document } = locate(ctx, documentId);
        const why = requireReason(reason, "o motivo da recusa");
        const from = document.state;
        document.state = "needs_update";
        db.audit(ctx, "document.reject", { kind: "document", id: document.id, label: `${document.title} — ${provider.name}` }, why, [
          { field: "Estado", from: DOCUMENT_STATE_LABELS[from], to: DOCUMENT_STATE_LABELS.needs_update },
        ]);
        db.commit("documents", "providers");
        return toItem(ctx.state, provider, document);
      }),
  };
}
