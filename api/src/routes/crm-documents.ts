import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type DocumentRow = typeof schema.crmDocuments.$inferSelect;

const CATEGORIES = ["Contrato", "Alvará", "Documento fiscal", "Foto do estabelecimento", "Outro"] as const;
const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const uploadBodySchema = z.object({
  company_id: z.string().min(1),
  name: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  category: z.enum(CATEGORIES),
  expires_at: z.string().optional(),
  url: z.string().optional(),
});

const restoreBodySchema = z.object({
  id: z.string().min(1),
  company_id: z.string().min(1),
  name: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  category: z.enum(CATEGORIES),
  uploaded_at: z.string().optional(),
  uploaded_by: z.string().optional(),
  expires_at: z.string().optional(),
  url: z.string().optional(),
});

function presentDocument(row: DocumentRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    name: row.name,
    category: row.category,
    mime: row.mime,
    size: row.size,
    uploaded_at: row.createdAt.toISOString(),
    uploaded_by: row.uploadedBy,
    expires_at: row.expiresAt ? row.expiresAt.toISOString() : undefined,
    url: row.url ?? undefined,
  };
}

async function loadDocumentOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmDocuments).where(eq(schema.crmDocuments.id, id)).limit(1);
  if (!row) throw apiError("not_found", "O documento não existe ou já foi removido.");
  return row;
}

export async function crmDocumentsRoutes(app: FastifyInstance) {
  app.get("/crm/documents", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmDocuments);
    reply.send(listEnvelope(rows.filter((row) => !row.removed).map(presentDocument)));
  });

  app.get("/crm/documents/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadDocumentOrNotFound(id);
    if (row.removed) throw apiError("not_found", "O documento não existe ou já foi removido.");
    reply.send(dataEnvelope(presentDocument(row)));
  });

  app.post("/crm/documents", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = uploadBodySchema.parse(request.body);

    if (!DOCUMENT_TYPES.includes(body.mime)) {
      throw apiError("validation", "Só PDF, JPG, PNG ou WebP.", { issues: [{ field: "mime", message: "Só PDF, JPG, PNG ou WebP." }] });
    }
    if (body.size > MAX_DOCUMENT_BYTES) {
      throw apiError("validation", "O ficheiro é demasiado grande; o máximo é 10 MB.", { issues: [{ field: "size", message: "O máximo é 10 MB." }] });
    }

    const [row] = await db
      .insert(schema.crmDocuments)
      .values({
        id: newId("doc"),
        companyId: body.company_id,
        name: body.name,
        category: body.category,
        mime: body.mime,
        size: body.size,
        uploadedBy: request.adminAccount!.fullName,
        expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
        url: body.url,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível guardar o documento.");
    reply.status(201).send(dataEnvelope(presentDocument(row)));
  });

  app.delete("/crm/documents/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const document = await loadDocumentOrNotFound(id);
    if (document.removed) throw apiError("not_found", "O documento não existe ou já foi removido.");

    const [row] = await db.update(schema.crmDocuments).set({ removed: true }).where(eq(schema.crmDocuments.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível remover o documento.");
    reply.send(dataEnvelope(presentDocument(row)));
  });

  app.put("/crm/documents/:id/restore", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = restoreBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmDocuments.id }).from(schema.crmDocuments).where(eq(schema.crmDocuments.id, id)).limit(1);
    const values = {
      companyId: body.company_id,
      name: body.name,
      category: body.category,
      mime: body.mime,
      size: body.size,
      uploadedBy: body.uploaded_by ?? request.adminAccount!.fullName,
      expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
      url: body.url,
      removed: false,
    };

    const [row] = existing
      ? await db.update(schema.crmDocuments).set(values).where(eq(schema.crmDocuments.id, id)).returning()
      : await db.insert(schema.crmDocuments).values({ id: body.id, ...values }).returning();
    if (!row) throw apiError("server", "Não foi possível restaurar o documento.");
    reply.send(dataEnvelope(presentDocument(row)));
  });
}
