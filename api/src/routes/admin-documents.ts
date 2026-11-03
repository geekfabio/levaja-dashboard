import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { providerDocuments, providers, vehicles } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type DocumentRow = typeof providerDocuments.$inferSelect;

const DOCUMENT_STATUSES = ["pending", "verified", "rejected"] as const;

const listQuerySchema = pageQuerySchema.extend({ state: z.string().optional(), q: z.string().optional() });
const approveBodySchema = z.object({ valid_until: z.string() });
const rejectBodySchema = z.object({ reason: z.string().optional() });

function csv(value: string | undefined) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function present(document: DocumentRow) {
  const [provider] = await db.select().from(providers).where(eq(providers.accountId, document.providerAccountId)).limit(1);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, document.providerAccountId)).limit(1);
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.providerAccountId, document.providerAccountId)).limit(1);

  return {
    id: document.id,
    provider_id: document.providerAccountId,
    provider_name: account?.fullName ?? "",
    vehicle_plate: vehicle?.plate ?? "",
    title: document.title,
    kind: document.kind,
    file_url: document.fileUrl,
    valid_until: document.validUntil ? document.validUntil.toISOString() : null,
    status: document.status,
    submitted_at: document.createdAt.toISOString(),
    verified_provider: provider?.verified ?? false,
  };
}

async function loadDocumentOrNotFound(id: string): Promise<DocumentRow> {
  const [row] = await db.select().from(providerDocuments).where(eq(providerDocuments.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Documento não encontrado.");
  return row;
}

export async function adminDocumentRoutes(app: FastifyInstance) {
  app.get("/admin/documents", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "documents.review");
    const query = listQuerySchema.parse(request.query);

    const stateFilter = csv(query.state) ?? ["pending", "rejected"];
    if (!stateFilter.every((value) => (DOCUMENT_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de documento inválido.");
    }

    const rows = await db.select().from(providerDocuments);
    const filtered = rows.filter((row) => stateFilter.includes(row.status));
    const presented = await Promise.all(filtered.map(present));
    const matched = presented
      .filter((item) => matchesText(query.q, item.provider_name, item.vehicle_plate, item.title))
      .sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1));

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/documents/expiring", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "documents.review");
    const query = z.object({ within_days: z.coerce.number().int().positive().optional() }).parse(request.query);
    const withinDays = query.within_days ?? 30;
    const now = new Date();
    const limit = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const rows = await db.select().from(providerDocuments).where(eq(providerDocuments.status, "verified"));
    const filtered = rows.filter((row) => row.validUntil && row.validUntil >= now && row.validUntil <= limit);
    const presented = await Promise.all(filtered.map(present));
    presented.sort((a, b) => ((a.valid_until ?? "") < (b.valid_until ?? "") ? -1 : 1));

    return dataEnvelope(presented);
  });

  app.post("/admin/documents/:id/approve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "documents.review");
    const { id } = request.params as { id: string };
    const body = approveBodySchema.parse(request.body);

    const validUntil = new Date(body.valid_until);
    if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
      throw apiError("validation", "A validade tem de ser uma data futura.", {
        issues: [{ field: "valid_until", message: "A validade tem de ser uma data futura." }],
      });
    }

    const document = await loadDocumentOrNotFound(id);
    if (document.status === "verified" && document.validUntil?.getTime() === validUntil.getTime()) {
      throw apiError("invalid_transition", "Este documento já está verificado.");
    }

    await db.update(providerDocuments).set({ status: "verified", validUntil }).where(eq(providerDocuments.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "document.approve",
      targetModule: "document",
      targetId: id,
      targetLabel: document.title,
      reason: "Documento aprovado.",
      changes: [
        { field: "Estado", from: document.status, to: "verified" },
        { field: "Validade", from: document.validUntil?.toISOString() ?? "—", to: validUntil.toISOString() },
      ],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadDocumentOrNotFound(id)));
  });

  app.post("/admin/documents/:id/reject", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "documents.review");
    const { id } = request.params as { id: string };
    const body = rejectBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da recusa");

    const document = await loadDocumentOrNotFound(id);
    await db.update(providerDocuments).set({ status: "rejected" }).where(eq(providerDocuments.id, id));
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "document.reject",
      targetModule: "document",
      targetId: id,
      targetLabel: document.title,
      reason,
      changes: [{ field: "Estado", from: document.status, to: "rejected" }],
      sensitive: true,
    });

    return dataEnvelope(await present(await loadDocumentOrNotFound(id)));
  });
}
