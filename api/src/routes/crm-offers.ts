import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";

type OfferRow = typeof schema.crmDiscountOffers.$inferSelect;

const SCOPES = ["Categorias habituais", "Toda a encomenda"] as const;
const SETTABLE_STATUSES = ["Apresentada", "Recusada"] as const;
const OPEN_STATUSES = ["Por apresentar", "Apresentada"] as const;

const MAX_DISCOUNT_PERCENT = 30;

const createBodySchema = z.object({
  company_id: z.string().min(1),
  percent: z.number().int(),
  scope: z.enum(SCOPES),
  valid_days: z.number().int(),
});

const setStatusBodySchema = z.object({ status: z.enum(SETTABLE_STATUSES) });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function presentOffer(row: OfferRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    percent: row.percent,
    scope: row.scope,
    categories: row.categories,
    status: row.status,
    origin: row.origin ?? undefined,
    owner: row.owner ?? undefined,
    automation_id: row.automationId ?? undefined,
    created_at: row.createdAt.toISOString(),
    valid_until: row.validUntil.toISOString().slice(0, 10),
  };
}

async function loadOfferOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmDiscountOffers).where(eq(schema.crmDiscountOffers.id, id)).limit(1);
  if (!row) throw apiError("not_found", "A proposta não existe ou foi removida.");
  return row;
}

export async function crmOffersRoutes(app: FastifyInstance) {
  app.get("/crm/offers", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmDiscountOffers);
    reply.send(listEnvelope(rows.map(presentOffer)));
  });

  app.post("/crm/offers", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);

    if (body.percent < 1 || body.percent > MAX_DISCOUNT_PERCENT) {
      throw apiError("validation", `O desconto tem de estar entre 1% e ${MAX_DISCOUNT_PERCENT}%.`, {
        issues: [{ field: "percent", message: `O desconto tem de estar entre 1% e ${MAX_DISCOUNT_PERCENT}%.` }],
      });
    }
    if (body.valid_days < 1) {
      throw apiError("validation", "A validade tem de ser de pelo menos 1 dia.", {
        issues: [{ field: "valid_days", message: "A validade tem de ser de pelo menos 1 dia." }],
      });
    }

    const [company] = await db
      .select({ id: schema.crmCompanies.id, owner: schema.crmCompanies.owner })
      .from(schema.crmCompanies)
      .where(eq(schema.crmCompanies.id, body.company_id))
      .limit(1);
    if (!company) throw apiError("not_found", "O cliente não existe ou foi removido.");

    const createdAt = today();
    await db
      .update(schema.crmDiscountOffers)
      .set({ status: "Substituída" })
      .where(and(eq(schema.crmDiscountOffers.companyId, body.company_id), inArray(schema.crmDiscountOffers.status, [...OPEN_STATUSES])));

    const [row] = await db
      .insert(schema.crmDiscountOffers)
      .values({
        id: newId("of"),
        companyId: body.company_id,
        percent: body.percent,
        scope: body.scope,
        categories: [],
        status: "Por apresentar",
        origin: "Proposta manual",
        owner: company.owner,
        validUntil: new Date(`${addDays(createdAt, body.valid_days)}T00:00:00Z`),
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar a proposta.");
    reply.status(201).send(dataEnvelope(presentOffer(row)));
  });

  app.patch("/crm/offers/:id/status", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = setStatusBodySchema.parse(request.body);
    const offer = await loadOfferOrNotFound(id);

    if (offer.status === body.status) {
      reply.send(dataEnvelope(presentOffer(offer)));
      return;
    }

    const [row] = await db
      .update(schema.crmDiscountOffers)
      .set({ status: body.status })
      .where(eq(schema.crmDiscountOffers.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível actualizar a proposta.");
    reply.send(dataEnvelope(presentOffer(row)));
  });
}
