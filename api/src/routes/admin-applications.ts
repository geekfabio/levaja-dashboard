import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as argon2 from "argon2";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { providerApplications, providers, vehicles } from "../db/schema/ops";
import { findAccountByEmailAndKind } from "../lib/account";
import { recordAdminAudit } from "../lib/admin-audit";
import { presentApplication } from "../lib/application-presenter";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { sendMail } from "../lib/mailer";
import { listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type ApplicationRow = typeof providerApplications.$inferSelect;

const listQuerySchema = pageQuerySchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const reasonBodySchema = z.object({ reason: z.string().optional() });

async function loadApplicationOrNotFound(id: string): Promise<ApplicationRow> {
  const [row] = await db.select().from(providerApplications).where(eq(providerApplications.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Candidatura não encontrada.");
  return row;
}

function generateTemporaryPassword() {
  return randomBytes(9).toString("base64url");
}

const welcomeMail = (tempPassword: string) => ({
  subject: "A tua candidatura AngoLeva foi aprovada",
  body: `A tua candidatura para seres prestador AngoLeva foi aprovada. Entra na app com a palavra-passe temporária ${tempPassword} e altera-a de seguida em "A minha conta".`,
});

export async function adminApplicationRoutes(app: FastifyInstance) {
  app.get("/admin/applications", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "applications.manage");
    const query = listQuerySchema.parse(request.query);

    const rows = await db.select().from(providerApplications);
    const filtered = query.status ? rows.filter((row) => row.status === query.status) : rows;
    const sorted = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = sorted.map(presentApplication);

    return listPageEnvelope(paginate(items, query));
  });

  app.get("/admin/applications/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "applications.manage");
    const { id } = request.params as { id: string };
    const row = await loadApplicationOrNotFound(id);
    return dataEnvelope(presentApplication(row));
  });

  app.post("/admin/applications/:id/approve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "applications.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason);

    const application = await loadApplicationOrNotFound(id);
    if (application.status !== "pending") {
      throw apiError("invalid_transition", "Só é possível aprovar candidaturas pendentes.");
    }

    const existingAccount = await findAccountByEmailAndKind(application.email, "provider");
    if (existingAccount) {
      throw apiError("validation", "Já existe uma conta de prestador com este email.", {
        issues: [{ field: "email", message: "Já existe uma conta de prestador com este email." }],
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const accountId = newId("acc");

    await db.insert(accounts).values({
      id: accountId,
      kind: "provider",
      email: application.email,
      phone: application.phone,
      passwordHash,
      fullName: application.fullName,
      active: true,
    });

    await db.insert(providers).values({
      accountId,
      accountStatus: "pending_approval",
      coverageZoneIds: application.zoneIds,
      coverageServiceTypes: application.serviceTypes,
    });

    const vehicle = application.vehicle as
      | { brand: string; model: string; plate: string; color: string; class: string; category_label: string; capacity_kg?: number | null; year?: number }
      | null;
    if (vehicle) {
      await db.insert(vehicles).values({
        id: newId("veh"),
        providerAccountId: accountId,
        brand: vehicle.brand,
        model: vehicle.model,
        plate: vehicle.plate,
        color: vehicle.color,
        vehicleClass: vehicle.class,
        categoryLabel: vehicle.category_label,
        capacityKg: vehicle.capacity_kg ?? null,
        year: vehicle.year ?? null,
      });
    }

    const [updated] = await db
      .update(providerApplications)
      .set({
        status: "approved",
        reviewedByAccountId: admin.id,
        reviewedAt: new Date(),
        createdProviderAccountId: accountId,
      })
      .where(eq(providerApplications.id, id))
      .returning();

    await sendMail({ to: application.email, ...welcomeMail(temporaryPassword) }, request.log);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "application.approve",
      targetModule: "provider_application",
      targetId: id,
      targetLabel: application.fullName,
      reason,
      changes: [{ field: "Estado da candidatura", from: "Pendente", to: "Aprovada" }],
      sensitive: true,
    });

    reply.send(dataEnvelope(presentApplication(updated!)));
  });

  app.post("/admin/applications/:id/reject", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "applications.manage");
    const { id } = request.params as { id: string };
    const body = reasonBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo da rejeição");

    const application = await loadApplicationOrNotFound(id);
    if (application.status !== "pending") {
      throw apiError("invalid_transition", "Só é possível rejeitar candidaturas pendentes.");
    }

    const [updated] = await db
      .update(providerApplications)
      .set({
        status: "rejected",
        rejectionReason: reason,
        reviewedByAccountId: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(providerApplications.id, id))
      .returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "application.reject",
      targetModule: "provider_application",
      targetId: id,
      targetLabel: application.fullName,
      reason,
      changes: [{ field: "Estado da candidatura", from: "Pendente", to: "Rejeitada" }],
      sensitive: true,
    });

    reply.send(dataEnvelope(presentApplication(updated!)));
  });
}
