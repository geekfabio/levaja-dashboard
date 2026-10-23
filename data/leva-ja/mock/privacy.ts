import { PRIVACY_KIND_LABELS, PRIVACY_STATUS_LABELS, privacyUrgency } from "@/lib/leva-ja/trust";
import { ACTIVE_STATUSES } from "@/lib/leva-ja/status";
import type { PrivacyRequest } from "@/types/leva-ja";
import type { PrivacyRepository } from "../repositories/privacy";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, eventAt } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";

export function createMockPrivacy(db: MockDatabase): PrivacyRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.privacyRequests, id, "Pedido de dados");
  const label = (request: PrivacyRequest) => `${request.code} — ${PRIVACY_KIND_LABELS[request.kind]} · ${request.subjectName}`;
  const open = (request: PrivacyRequest) => {
    if (request.status === "completed" || request.status === "rejected") {
      throw new RepositoryError("invalid_transition", `O pedido já está «${PRIVACY_STATUS_LABELS[request.status].toLowerCase()}».`);
    }
  };

  const erase = (ctx: MockContext, request: PrivacyRequest) => {
    const busy = ctx.state.requests.some(
      (item) => (request.subjectKind === "client" ? item.clientId : item.providerId) === request.subjectId && (ACTIVE_STATUSES.includes(item.status) || (item.dispute && !item.dispute.resolvedAt)),
    );
    if (busy) throw new RepositoryError("validation", "O titular tem pedidos em curso ou disputas abertas. Conclua-os antes de eliminar os dados.");
    const anonymous = `Titular removido (${request.code})`;
    if (request.subjectKind === "client") {
      const client = findOr404(ctx.state.clients, request.subjectId, "Cliente");
      Object.assign(client, { name: anonymous, initials: "TR", email: "", phone: "+244 900 000 000", addresses: [], paymentMethods: [], avatar: undefined });
    } else {
      const provider = findOr404(ctx.state.providers, request.subjectId, "Prestador");
      Object.assign(provider, { name: anonymous, initials: "TR", email: "", phone: "+244 900 000 000", accountStatus: "suspended", availability: "offline", suspensionReason: "Conta eliminada a pedido do titular.", avatar: undefined });
    }
  };

  return {
    list: (filters = {}) =>
      db.run({ permission: "privacy.manage" }, ({ state }) =>
        paginate(
          state.privacyRequests
            .filter((request) => {
              if (filters.status?.length && !filters.status.includes(request.status)) return false;
              if (filters.kind?.length && !filters.kind.includes(request.kind)) return false;
              return matchesQuery(filters.q, request.code, request.subjectName, request.details);
            })
            .sort(byNewest((request) => request.receivedAt)),
          filters,
        ),
      ),

    summary: () =>
      db.run({ permission: "privacy.manage" }, ({ state, now }) => {
        const nowMs = now.getTime();
        const since = new Date(nowMs - 30 * DAY).toISOString();
        return {
          open: state.privacyRequests.filter((request) => privacyUrgency(request, nowMs) !== "closed").length,
          dueSoon: state.privacyRequests.filter((request) => privacyUrgency(request, nowMs) === "due_soon").length,
          overdue: state.privacyRequests.filter((request) => privacyUrgency(request, nowMs) === "overdue").length,
          completedLast30: state.privacyRequests.filter((request) => request.status === "completed" && (request.completedAt ?? "") >= since).length,
        };
      }),

    get: (id) => db.run({ permission: "privacy.manage" }, (ctx) => find(ctx, id)),

    start: (id) =>
      db.run({ permission: "privacy.manage" }, (ctx) => {
        const request = find(ctx, id);
        if (request.status !== "received") throw new RepositoryError("invalid_transition", "O pedido já está em tratamento.");
        request.status = "in_progress";
        request.assigneeName = ctx.session.user.name;
        db.audit(ctx, "privacy.start", { kind: "privacy", id, label: label(request) }, undefined, [
          { field: "Estado", from: PRIVACY_STATUS_LABELS.received, to: PRIVACY_STATUS_LABELS.in_progress },
        ]);
        db.commit("support");
        return request;
      }),

    complete: (id, resolution) =>
      db.run({ permission: "privacy.manage" }, (ctx) => {
        const request = find(ctx, id);
        open(request);
        const why = requireReason(resolution, "o que foi feito");
        if (request.kind === "erasure") erase(ctx, request);
        const from = PRIVACY_STATUS_LABELS[request.status];
        request.status = "completed";
        request.resolution = why;
        request.completedAt = ctx.nowIso;
        request.assigneeName = request.assigneeName ?? ctx.session.user.name;
        db.audit(ctx, "privacy.complete", { kind: "privacy", id, label: label(request) }, why, [{ field: "Estado", from, to: PRIVACY_STATUS_LABELS.completed }]);
        db.commit("support", "providers");
        return request;
      }),

    reject: (id, reason) =>
      db.run({ permission: "privacy.manage" }, (ctx) => {
        const request = find(ctx, id);
        open(request);
        const why = requireReason(reason, "o fundamento da recusa");
        const from = PRIVACY_STATUS_LABELS[request.status];
        request.status = "rejected";
        request.resolution = why;
        request.completedAt = ctx.nowIso;
        db.audit(ctx, "privacy.reject", { kind: "privacy", id, label: label(request) }, why, [{ field: "Estado", from, to: PRIVACY_STATUS_LABELS.rejected }]);
        db.commit("support");
        return request;
      }),

    exportData: (id) =>
      db.run({ permission: "privacy.manage" }, (ctx) => {
        const request = find(ctx, id);
        if (request.kind !== "access" && request.kind !== "portability") throw new RepositoryError("validation", "A exportação só existe para pedidos de acesso ou portabilidade.");
        let data: Record<string, unknown>;
        if (request.subjectKind === "client") {
          const client = findOr404(ctx.state.clients, request.subjectId, "Cliente");
          data = {
            perfil: { nome: client.name, email: client.email, telefone: client.phone, registadoEm: client.createdAt },
            moradas: client.addresses.map((address) => ({ descricao: address.label, zona: address.area, cidade: address.city })),
            metodosDePagamento: client.paymentMethods.map((method) => ({ tipo: method.kind, descricao: method.label })),
            pedidos: ctx.state.requests
              .filter((item) => item.clientId === client.id)
              .map((item) => ({ codigo: item.code, criadoEm: item.createdAt, estado: item.status, valorKz: item.price.total, origem: item.origin.label, destino: item.destination.label, pagoEm: eventAt(item, "paid") ?? null })),
            ocorrencias: ctx.state.tickets.filter((ticket) => ticket.requesterId === client.id).map((ticket) => ({ codigo: ticket.code, assunto: ticket.subject, criadaEm: ticket.createdAt })),
          };
        } else {
          const provider = findOr404(ctx.state.providers, request.subjectId, "Prestador");
          data = {
            perfil: { nome: provider.name, email: provider.email, telefone: provider.phone, desde: provider.joinedAt },
            viatura: { marca: provider.vehicle.brand, modelo: provider.vehicle.model, matricula: provider.vehicle.plate },
            documentos: provider.documents.map((document) => ({ documento: document.title, validade: document.validUntil, estado: document.state })),
            servicos: ctx.state.requests.filter((item) => item.providerId === provider.id).map((item) => ({ codigo: item.code, criadoEm: item.createdAt, estado: item.status, ganhoKz: item.providerEarning })),
          };
        }
        db.audit(ctx, "privacy.export", { kind: "privacy", id, label: label(request) }, "Exportação dos dados pessoais gerada.");
        db.commit("support");
        return { subject: request.subjectName, generatedAt: ctx.nowIso, data };
      }),
  };
}
