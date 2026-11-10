import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { privacyRequests } from "../db/schema/admin";
import {
  clientAddresses,
  clientPaymentMethods,
  clients,
  providerDocuments,
  providers,
  serviceRequests,
  supportTickets,
  vehicles,
  walletTransactions,
} from "../db/schema/ops";
import { disputes } from "../db/schema/disputes";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { listPageEnvelope, pageQuerySchema, csvList, paginate } from "../lib/pagination";
import { ACTIVE_REQUEST_STATUSES, PROVIDER_BUSY_STATUSES } from "../lib/request-state";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type PrivacyRequestRow = typeof privacyRequests.$inferSelect;

const PRIVACY_KIND_LABELS: Record<PrivacyRequestRow["kind"], string> = {
  access: "Acesso aos dados",
  rectification: "Rectificação",
  erasure: "Eliminação",
  portability: "Portabilidade",
  objection: "Oposição ao tratamento",
};

const PRIVACY_STATUS_LABELS: Record<PrivacyRequestRow["status"], string> = {
  received: "Recebido",
  in_progress: "Em tratamento",
  completed: "Concluído",
  rejected: "Recusado",
};

const PRIVACY_DUE_SOON_DAYS = 7;
const DAY_MS = 86_400_000;

const listQuerySchema = pageQuerySchema.extend({
  status: z.string().optional(),
  kind: z.string().optional(),
  q: z.string().optional(),
});

const completeBodySchema = z.object({ resolution: z.string().optional() });
const rejectBodySchema = z.object({ reason: z.string().optional() });

function urgencyOf(request: PrivacyRequestRow, now: number): "overdue" | "due_soon" | "ok" | "closed" {
  if (request.status === "completed" || request.status === "rejected") return "closed";
  const left = request.dueAt.getTime() - now;
  if (left < 0) return "overdue";
  return left < PRIVACY_DUE_SOON_DAYS * DAY_MS ? "due_soon" : "ok";
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function presentPrivacyRequest(request: PrivacyRequestRow, now: number) {
  const assignee = request.assigneeAccountId
    ? (await db.select().from(accounts).where(eq(accounts.id, request.assigneeAccountId)).limit(1))[0]
    : undefined;
  return {
    id: request.id,
    code: request.code,
    subject_kind: request.subjectKind,
    subject_id: request.subjectAccountId,
    subject_name: request.subjectName,
    kind: request.kind,
    channel: request.channel,
    details: request.details,
    received_at: request.receivedAt.toISOString(),
    due_at: request.dueAt.toISOString(),
    status: request.status,
    assignee_name: assignee?.fullName ?? null,
    resolution: request.resolution,
    completed_at: request.completedAt ? request.completedAt.toISOString() : null,
    urgency: urgencyOf(request, now),
  };
}

async function loadRequestOrNotFound(id: string) {
  const [request] = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id)).limit(1);
  if (!request) throw apiError("not_found", "Pedido de dados não encontrado.");
  return request;
}

function ensureOpen(request: PrivacyRequestRow) {
  if (request.status === "completed" || request.status === "rejected") {
    throw apiError("invalid_transition", `O pedido já está «${PRIVACY_STATUS_LABELS[request.status].toLowerCase()}».`);
  }
}

async function requireSubjectNotBusy(request: PrivacyRequestRow) {
  const column = request.subjectKind === "client" ? serviceRequests.clientAccountId : serviceRequests.providerAccountId;
  const own = await db.select().from(serviceRequests).where(eq(column, request.subjectAccountId));
  const statuses = request.subjectKind === "client" ? ACTIVE_REQUEST_STATUSES : PROVIDER_BUSY_STATUSES;
  const busy = own.some((row) => (statuses as readonly string[]).includes(row.status));
  if (busy) throw apiError("validation", "O titular tem pedidos em curso. Conclua-os antes de eliminar os dados.");

  const ownIds = own.map((row) => row.id);
  if (ownIds.length > 0) {
    const openDisputes = await db.select().from(disputes).where(inArray(disputes.requestId, ownIds));
    if (openDisputes.some((dispute) => !dispute.resolvedAt)) {
      throw apiError("validation", "O titular tem disputas abertas. Conclua-as antes de eliminar os dados.");
    }
  }
}

async function eraseSubject(request: PrivacyRequestRow) {
  const anonymous = `Titular removido (${request.code})`;
  const anonymousEmail = `eliminado+${request.subjectAccountId}@angoleva.invalid`;
  await db
    .update(accounts)
    .set({ fullName: anonymous, email: anonymousEmail, phone: "+244 900 000 000" })
    .where(eq(accounts.id, request.subjectAccountId));

  if (request.subjectKind === "client") {
    await db.delete(clientAddresses).where(eq(clientAddresses.clientAccountId, request.subjectAccountId));
    await db.delete(clientPaymentMethods).where(eq(clientPaymentMethods.clientAccountId, request.subjectAccountId));
  } else {
    await db
      .update(providers)
      .set({ accountStatus: "suspended", online: false, suspensionReason: "Conta eliminada a pedido do titular." })
      .where(eq(providers.accountId, request.subjectAccountId));
  }
}

async function buildClientExport(accountId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.accountId, accountId)).limit(1);
  if (!account || !client) throw apiError("not_found", "Cliente não encontrado.");
  const addresses = await db.select().from(clientAddresses).where(eq(clientAddresses.clientAccountId, accountId));
  const paymentMethods = await db.select().from(clientPaymentMethods).where(eq(clientPaymentMethods.clientAccountId, accountId));
  const own = await db.select().from(serviceRequests).where(eq(serviceRequests.clientAccountId, accountId));
  const tickets = await db.select().from(supportTickets).where(eq(supportTickets.accountId, accountId));

  return {
    perfil: { nome: account.fullName, email: account.email, telefone: account.phone ?? "", registado_em: account.createdAt.toISOString() },
    moradas: addresses.map((address) => ({ descricao: address.label, local: address.place })),
    metodos_de_pagamento: paymentMethods.map((method) => ({ tipo: method.type, descricao: method.title })),
    pedidos: own.map((request) => ({
      codigo: request.code,
      criado_em: request.createdAt.toISOString(),
      estado: request.status,
      pricing: request.pricing ?? null,
    })),
    ocorrencias: tickets.map((ticket) => ({ codigo: ticket.code, assunto: ticket.reason, criada_em: ticket.createdAt.toISOString() })),
  };
}

async function buildProviderExport(accountId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const [provider] = await db.select().from(providers).where(eq(providers.accountId, accountId)).limit(1);
  if (!account || !provider) throw apiError("not_found", "Prestador não encontrado.");
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.providerAccountId, accountId)).limit(1);
  const documents = await db.select().from(providerDocuments).where(eq(providerDocuments.providerAccountId, accountId));
  const own = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, accountId));
  const earnings = await db.select().from(walletTransactions).where(eq(walletTransactions.providerAccountId, accountId));

  return {
    perfil: { nome: account.fullName, email: account.email, telefone: account.phone ?? "", desde: account.createdAt.toISOString() },
    viatura: vehicle ? { marca: vehicle.brand, modelo: vehicle.model, matricula: vehicle.plate } : null,
    documentos: documents.map((document) => ({ documento: document.title, validade: document.validUntil?.toISOString() ?? null, estado: document.status })),
    servicos: own.map((request) => ({ codigo: request.code, criado_em: request.createdAt.toISOString(), estado: request.status, ganho_kz: request.providerEarningKz ?? null })),
    ganhos: earnings.map((row) => ({ titulo: row.title, valor_kz: row.amountKz, estado: row.status, em: row.createdAt.toISOString() })),
  };
}

export async function adminPrivacyRoutes(app: FastifyInstance) {
  app.get("/admin/privacy/requests", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "privacy.manage");
    const query = listQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status);
    const kindFilter = csvList(query.kind);

    const rows = await db.select().from(privacyRequests);
    const now = Date.now();
    const filtered = rows
      .filter((row) => {
        if (statusFilter?.length && !statusFilter.includes(row.status)) return false;
        if (kindFilter?.length && !kindFilter.includes(row.kind)) return false;
        return matchesText(query.q, row.code, row.subjectName, row.details);
      })
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    const presented = await Promise.all(filtered.map((row) => presentPrivacyRequest(row, now)));
    return listPageEnvelope(paginate(presented, query));
  });

  app.get("/admin/privacy/summary", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "privacy.manage");
    const rows = await db.select().from(privacyRequests);
    const now = Date.now();
    const since = new Date(now - 30 * DAY_MS);
    return dataEnvelope({
      open: rows.filter((row) => urgencyOf(row, now) !== "closed").length,
      due_soon: rows.filter((row) => urgencyOf(row, now) === "due_soon").length,
      overdue: rows.filter((row) => urgencyOf(row, now) === "overdue").length,
      completed_last_30: rows.filter((row) => row.status === "completed" && row.completedAt && row.completedAt >= since).length,
    });
  });

  app.get("/admin/privacy/requests/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "privacy.manage");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    return dataEnvelope(await presentPrivacyRequest(row, Date.now()));
  });

  app.post("/admin/privacy/requests/:id/start", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "privacy.manage");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    if (row.status !== "received") {
      throw apiError("invalid_transition", "O pedido já está em tratamento.");
    }

    await db.update(privacyRequests).set({ status: "in_progress", assigneeAccountId: admin.id }).where(eq(privacyRequests.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "privacy.start",
      targetModule: "privacy",
      targetId: id,
      targetLabel: `${row.code} — ${PRIVACY_KIND_LABELS[row.kind]} · ${row.subjectName}`,
      changes: [{ field: "Estado", from: PRIVACY_STATUS_LABELS.received, to: PRIVACY_STATUS_LABELS.in_progress }],
    });

    const updated = await loadRequestOrNotFound(id);
    return dataEnvelope(await presentPrivacyRequest(updated, Date.now()));
  });

  app.post("/admin/privacy/requests/:id/complete", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "privacy.manage");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    ensureOpen(row);
    const body = completeBodySchema.parse(request.body);
    const why = requireReason(body.resolution, "o que foi feito");

    if (row.kind === "erasure") {
      await requireSubjectNotBusy(row);
      await eraseSubject(row);
    }

    const from = PRIVACY_STATUS_LABELS[row.status];
    await db
      .update(privacyRequests)
      .set({ status: "completed", resolution: why, completedAt: new Date(), assigneeAccountId: row.assigneeAccountId ?? admin.id })
      .where(eq(privacyRequests.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "privacy.complete",
      targetModule: "privacy",
      targetId: id,
      targetLabel: `${row.code} — ${PRIVACY_KIND_LABELS[row.kind]} · ${row.subjectName}`,
      reason: why,
      changes: [{ field: "Estado", from, to: PRIVACY_STATUS_LABELS.completed }],
      sensitive: true,
    });

    const updated = await loadRequestOrNotFound(id);
    return dataEnvelope(await presentPrivacyRequest(updated, Date.now()));
  });

  app.post("/admin/privacy/requests/:id/reject", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "privacy.manage");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    ensureOpen(row);
    const body = rejectBodySchema.parse(request.body);
    const why = requireReason(body.reason, "o fundamento da recusa");

    const from = PRIVACY_STATUS_LABELS[row.status];
    await db
      .update(privacyRequests)
      .set({ status: "rejected", resolution: why, completedAt: new Date() })
      .where(eq(privacyRequests.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "privacy.reject",
      targetModule: "privacy",
      targetId: id,
      targetLabel: `${row.code} — ${PRIVACY_KIND_LABELS[row.kind]} · ${row.subjectName}`,
      reason: why,
      changes: [{ field: "Estado", from, to: PRIVACY_STATUS_LABELS.rejected }],
      sensitive: true,
    });

    const updated = await loadRequestOrNotFound(id);
    return dataEnvelope(await presentPrivacyRequest(updated, Date.now()));
  });

  app.post("/admin/privacy/requests/:id/export", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "privacy.manage");
    const { id } = request.params as { id: string };
    const row = await loadRequestOrNotFound(id);
    if (row.kind !== "access" && row.kind !== "portability") {
      throw apiError("validation", "A exportação só existe para pedidos de acesso ou portabilidade.");
    }

    const data = row.subjectKind === "client" ? await buildClientExport(row.subjectAccountId) : await buildProviderExport(row.subjectAccountId);
    const generatedAt = new Date().toISOString();
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "privacy.export",
      targetModule: "privacy",
      targetId: id,
      targetLabel: `${row.code} — ${PRIVACY_KIND_LABELS[row.kind]} · ${row.subjectName}`,
      reason: "Exportação dos dados pessoais gerada.",
      sensitive: true,
    });

    return dataEnvelope({ subject: row.subjectName, generated_at: generatedAt, data });
  });
}
