import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { apiError, dataEnvelope } from "../lib/envelope";

type ContactRow = typeof schema.crmContacts.$inferSelect;

const CONTACTABILITY_STATUSES = ["Válido", "Inválido", "Saiu da empresa", "Pediu remoção"] as const;
const CONSENT_CHANNELS = ["email", "sms", "whatsapp"] as const;
const ANONYMIZED_NAME = "Contacto anonimizado";

const consentStateSchema = z.object({ granted: z.boolean(), date: z.string(), origin: z.string() });
const consentSchema = z.object({
  email: consentStateSchema,
  sms: consentStateSchema,
  whatsapp: consentStateSchema,
});

const createBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  company_id: z.string(),
  company_name: z.string().default(""),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  contactability: z.enum(CONTACTABILITY_STATUSES).default("Válido"),
  consent: consentSchema,
});

const updateBodySchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  company_id: z.string().optional(),
  company_name: z.string().optional(),
});

const restoreBodySchema = createBodySchema.extend({ id: z.string().min(1) });
const setContactabilityBodySchema = z.object({ status: z.enum(CONTACTABILITY_STATUSES) });
const toggleConsentBodySchema = z.object({ channel: z.enum(CONSENT_CHANNELS) });
const mergeBodySchema = z.object({
  primary_id: z.string(),
  secondary_id: z.string(),
  choices: z.object({
    role: z.enum(["primary", "secondary"]),
    phone: z.enum(["primary", "secondary"]),
    whatsapp: z.enum(["primary", "secondary"]),
    email: z.enum(["primary", "secondary"]),
  }),
});
const restoreMergeBodySchema = z.object({ contacts: z.array(restoreBodySchema) });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function presentContact(row: ContactRow) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    company_id: row.companyId,
    company_name: row.companyName,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    contactability: row.contactability,
    consent: row.consent,
    created_at: row.createdAt.toISOString(),
  };
}

async function loadContactOrNotFound(id: string) {
  const [row] = await db.select().from(schema.crmContacts).where(eq(schema.crmContacts.id, id)).limit(1);
  if (!row) throw apiError("not_found", "O contacto não existe ou foi removido.");
  return row;
}

export async function crmContactsRoutes(app: FastifyInstance) {
  app.get("/crm/contacts", { preHandler: authenticateAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.crmContacts);
    reply.send({ data: rows.map(presentContact), meta: { count: rows.length } });
  });

  app.get("/crm/contacts/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await loadContactOrNotFound(id);
    reply.send(dataEnvelope(presentContact(row)));
  });

  app.post("/crm/contacts", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmContacts.id }).from(schema.crmContacts).where(eq(schema.crmContacts.id, body.id)).limit(1);
    if (existing) {
      throw apiError("validation", "Já existe um contacto com este identificador.", {
        issues: [{ field: "id", message: "Já existe um contacto com este identificador." }],
      });
    }

    const [row] = await db
      .insert(schema.crmContacts)
      .values({
        id: body.id,
        name: body.name,
        role: body.role,
        companyId: body.company_id,
        companyName: body.company_name,
        phone: body.phone,
        whatsapp: body.whatsapp,
        email: body.email,
        contactability: body.contactability,
        consent: body.consent,
      })
      .returning();
    if (!row) throw apiError("server", "Não foi possível criar o contacto.");
    reply.status(201).send(dataEnvelope(presentContact(row)));
  });

  app.patch("/crm/contacts/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBodySchema.parse(request.body);
    await loadContactOrNotFound(id);

    const patch: Partial<ContactRow> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.role !== undefined) patch.role = body.role;
    if (body.phone !== undefined) patch.phone = body.phone;
    if (body.whatsapp !== undefined) patch.whatsapp = body.whatsapp;
    if (body.email !== undefined) patch.email = body.email;
    if (body.company_id !== undefined) patch.companyId = body.company_id;
    if (body.company_name !== undefined) patch.companyName = body.company_name;

    const [row] = await db.update(schema.crmContacts).set(patch).where(eq(schema.crmContacts.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o contacto.");
    reply.send(dataEnvelope(presentContact(row)));
  });

  app.put("/crm/contacts/:id/restore", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = restoreBodySchema.parse(request.body);

    const [existing] = await db.select({ id: schema.crmContacts.id }).from(schema.crmContacts).where(eq(schema.crmContacts.id, id)).limit(1);
    const values = {
      name: body.name,
      role: body.role,
      companyId: body.company_id,
      companyName: body.company_name,
      phone: body.phone,
      whatsapp: body.whatsapp,
      email: body.email,
      contactability: body.contactability,
      consent: body.consent,
    };

    const [row] = existing
      ? await db.update(schema.crmContacts).set(values).where(eq(schema.crmContacts.id, id)).returning()
      : await db.insert(schema.crmContacts).values({ id: body.id, ...values }).returning();
    if (!row) throw apiError("server", "Não foi possível restaurar o contacto.");
    reply.send(dataEnvelope(presentContact(row)));
  });

  app.patch("/crm/contacts/:id/contactability", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = setContactabilityBodySchema.parse(request.body);
    await loadContactOrNotFound(id);

    const [row] = await db.update(schema.crmContacts).set({ contactability: body.status }).where(eq(schema.crmContacts.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o contacto.");
    reply.send(dataEnvelope(presentContact(row)));
  });

  app.post("/crm/contacts/:id/consent/toggle", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = toggleConsentBodySchema.parse(request.body);
    const contact = await loadContactOrNotFound(id);

    const consent = contact.consent as Record<string, { granted: boolean; date: string; origin: string }>;
    const nextConsent = {
      ...consent,
      [body.channel]: { granted: !consent[body.channel]!.granted, date: today(), origin: "Atualizado manualmente" },
    };
    const [row] = await db.update(schema.crmContacts).set({ consent: nextConsent }).where(eq(schema.crmContacts.id, id)).returning();
    if (!row) throw apiError("server", "Não foi possível actualizar o contacto.");
    reply.send(dataEnvelope(presentContact(row)));
  });

  app.post("/crm/contacts/merge", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = mergeBodySchema.parse(request.body);
    const primary = await loadContactOrNotFound(body.primary_id);
    const secondary = await loadContactOrNotFound(body.secondary_id);

    const primaryConsent = primary.consent as Record<string, { granted: boolean; date: string; origin: string }>;
    const secondaryConsent = secondary.consent as Record<string, { granted: boolean; date: string; origin: string }>;

    const merged = {
      role: body.choices.role === "secondary" ? secondary.role : primary.role,
      phone: body.choices.phone === "secondary" ? secondary.phone : primary.phone,
      whatsapp: body.choices.whatsapp === "secondary" ? secondary.whatsapp : primary.whatsapp,
      email: body.choices.email === "secondary" ? secondary.email : primary.email,
      consent: {
        email: primaryConsent.email!.granted ? primaryConsent.email : secondaryConsent.email,
        sms: primaryConsent.sms!.granted ? primaryConsent.sms : secondaryConsent.sms,
        whatsapp: primaryConsent.whatsapp!.granted ? primaryConsent.whatsapp : secondaryConsent.whatsapp,
      },
    };

    const [row] = await db.update(schema.crmContacts).set(merged).where(eq(schema.crmContacts.id, primary.id)).returning();
    if (!row) throw apiError("server", "Não foi possível fundir os contactos.");
    await db.delete(schema.crmContacts).where(eq(schema.crmContacts.id, secondary.id));

    reply.send(dataEnvelope({ merged: presentContact(row), removed_id: secondary.id }));
  });

  app.post("/crm/contacts/restore-merge", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const body = restoreMergeBodySchema.parse(request.body);

    for (const contact of body.contacts) {
      const [existing] = await db.select({ id: schema.crmContacts.id }).from(schema.crmContacts).where(eq(schema.crmContacts.id, contact.id)).limit(1);
      const values = {
        name: contact.name,
        role: contact.role,
        companyId: contact.company_id,
        companyName: contact.company_name,
        phone: contact.phone,
        whatsapp: contact.whatsapp,
        email: contact.email,
        contactability: contact.contactability,
        consent: contact.consent,
      };
      if (existing) {
        await db.update(schema.crmContacts).set(values).where(eq(schema.crmContacts.id, contact.id));
      } else {
        await db.insert(schema.crmContacts).values({ id: contact.id, ...values });
      }
    }

    const ids = body.contacts.map((item) => item.id);
    const rows = await db.select().from(schema.crmContacts);
    reply.send({ data: rows.filter((row) => ids.includes(row.id)).map(presentContact), meta: { count: ids.length } });
  });

  app.post("/crm/contacts/:id/anonymize", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const contact = await loadContactOrNotFound(id);

    if (contact.name === ANONYMIZED_NAME) {
      reply.send(dataEnvelope(presentContact(contact)));
      return;
    }

    const revoked = { granted: false, date: today(), origin: "Anonimização (Lei n.º 22/11)" };
    const [row] = await db
      .update(schema.crmContacts)
      .set({
        name: ANONYMIZED_NAME,
        role: "—",
        phone: "",
        whatsapp: "",
        email: "",
        contactability: "Pediu remoção",
        consent: { email: revoked, sms: revoked, whatsapp: revoked },
      })
      .where(eq(schema.crmContacts.id, id))
      .returning();
    if (!row) throw apiError("server", "Não foi possível anonimizar o contacto.");

    await db.delete(schema.crmConversations).where(eq(schema.crmConversations.contactId, id));

    reply.send(dataEnvelope(presentContact(row)));
  });
}
