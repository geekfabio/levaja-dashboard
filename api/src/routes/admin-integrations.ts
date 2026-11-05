import { desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { adminApiKeys, adminWebhookDeliveries, adminWebhooks } from "../db/schema/admin";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { recordAdminAudit } from "../lib/admin-audit";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";
import { hashOpaqueToken, newOpaqueToken } from "../lib/tokens";

const API_SCOPES = ["requests.read", "requests.write", "providers.read", "finance.read", "webhooks.manage"] as const;
const WEBHOOK_EVENTS = [
  "request.created",
  "request.assigned",
  "request.delivered",
  "request.cancelled",
  "payment.paid",
  "refund.paid",
] as const;
const EXPIRY_DAYS = [30, 90, 365] as const;

type ApiKeyRow = typeof adminApiKeys.$inferSelect;
type WebhookRow = typeof adminWebhooks.$inferSelect;
type WebhookDeliveryRow = typeof adminWebhookDeliveries.$inferSelect;

function maskSecret(secret: string) {
  return `${secret.slice(0, 8)}${"•".repeat(8)}${secret.slice(-4)}`;
}

function webhookUrlIssue(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return "Indique um endereço completo, começado por https://.";
  }
  if (parsed.protocol !== "https:") return "O endereço tem de usar https.";
  const host = parsed.hostname;
  if (host === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".local")) {
    return "Use um endereço público; redes internas não são aceites.";
  }
  return null;
}

async function accountNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const rows = await db.select().from(accounts).where(inArray(accounts.id, unique));
  return new Map(rows.map((row) => [row.id, row.fullName]));
}

function toWireDelivery(row: WebhookDeliveryRow) {
  return {
    id: row.id,
    event: row.event,
    at: row.at.toISOString(),
    status: row.status === "timeout" ? "timeout" : Number(row.status),
    duration_ms: row.durationMs,
    simulated: row.simulated,
  };
}

function toWireKey(row: ApiKeyRow, names: Map<string, string>) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    created_at: row.createdAt.toISOString(),
    created_by: names.get(row.createdByAccountId) ?? row.createdByAccountId,
    last_used_at: row.lastUsedAt?.toISOString(),
    expires_at: row.expiresAt?.toISOString(),
    revoked_at: row.revokedAt?.toISOString(),
    revoked_by: row.revokedByAccountId ? names.get(row.revokedByAccountId) ?? row.revokedByAccountId : undefined,
    revoke_reason: row.revokeReason ?? undefined,
  };
}

function toWireWebhook(row: WebhookRow, names: Map<string, string>, deliveries: WebhookDeliveryRow[]) {
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    events: row.events,
    active: row.active,
    secret_preview: row.secretPreview,
    created_at: row.createdAt.toISOString(),
    created_by: names.get(row.createdByAccountId) ?? row.createdByAccountId,
    deliveries: deliveries.map(toWireDelivery),
  };
}

const createKeySchema = z.object({
  name: z.string(),
  scopes: z.array(z.string()).default([]),
  expires_in_days: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable().optional(),
});

const revokeSchema = z.object({ reason: z.string().optional() });

const createWebhookSchema = z.object({
  url: z.string(),
  description: z.string().default(""),
  events: z.array(z.string()).default([]),
});

const setActiveSchema = z.object({ active: z.boolean() });

export async function adminIntegrationsRoutes(app: FastifyInstance) {
  app.get("/admin/integrations/keys", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "integrations.manage");
    const rows = await db.select().from(adminApiKeys).orderBy(desc(adminApiKeys.createdAt));
    const names = await accountNames(rows.flatMap((row) => [row.createdByAccountId, row.revokedByAccountId]));
    return listEnvelope(rows.map((row) => toWireKey(row, names)));
  });

  app.post("/admin/integrations/keys", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "integrations.manage");
    const body = createKeySchema.parse(request.body);

    const name = body.name.trim();
    if (name.length < 3) {
      throw apiError("validation", "Indique o nome da chave.", { issues: [{ field: "name", message: "Indique o nome da chave." }] });
    }
    const knownScopes = new Set<string>(API_SCOPES);
    if (body.scopes.length === 0 || body.scopes.some((scope) => !knownScopes.has(scope))) {
      throw apiError("validation", "Escolha pelo menos uma permissão.", { issues: [{ field: "scopes", message: "Escolha pelo menos uma permissão." }] });
    }
    const expiresInDays = body.expires_in_days ?? null;
    if (expiresInDays !== null && !(EXPIRY_DAYS as readonly number[]).includes(expiresInDays)) {
      throw apiError("validation", "Escolha uma validade de 30, 90 ou 365 dias.");
    }

    const secret = newOpaqueToken("lj_live");
    const now = new Date();
    const row = {
      id: newId("key"),
      name,
      prefix: secret.slice(0, 12),
      secretHash: hashOpaqueToken(secret),
      scopes: [...body.scopes],
      createdAt: now,
      createdByAccountId: admin.id,
      expiresAt: expiresInDays ? new Date(now.getTime() + expiresInDays * 86_400_000) : null,
    };
    await db.insert(adminApiKeys).values(row);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "integration.key_create",
      targetModule: "integration",
      targetId: row.id,
      targetLabel: `${row.name} (${row.prefix}…)`,
      reason: `Permissões: ${row.scopes.join(", ")}`,
    });

    const names = await accountNames([admin.id]);
    return dataEnvelope({ item: toWireKey({ ...row, lastUsedAt: null, revokedAt: null, revokedByAccountId: null, revokeReason: null } as ApiKeyRow, names), secret });
  });

  app.post("/admin/integrations/keys/:id/revoke", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "integrations.manage");
    const { id } = request.params as { id: string };
    const body = revokeSchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo");

    const [key] = await db.select().from(adminApiKeys).where(eq(adminApiKeys.id, id)).limit(1);
    if (!key) throw apiError("not_found", "Chave de API não encontrada.");
    if (key.revokedAt) throw apiError("invalid_transition", "A chave já foi revogada.");

    const now = new Date();
    const [updated] = await db
      .update(adminApiKeys)
      .set({ revokedAt: now, revokedByAccountId: admin.id, revokeReason: reason })
      .where(eq(adminApiKeys.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível revogar a chave.");

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "integration.key_revoke",
      targetModule: "integration",
      targetId: updated.id,
      targetLabel: `${updated.name} (${updated.prefix}…)`,
      reason,
      sensitive: true,
    });

    const names = await accountNames([updated.createdByAccountId, updated.revokedByAccountId]);
    return dataEnvelope(toWireKey(updated, names));
  });

  app.get("/admin/integrations/webhooks", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "integrations.manage");
    const rows = await db.select().from(adminWebhooks).orderBy(desc(adminWebhooks.createdAt));
    const names = await accountNames(rows.map((row) => row.createdByAccountId));
    const deliveryRows = rows.length ? await db.select().from(adminWebhookDeliveries).where(inArray(adminWebhookDeliveries.webhookId, rows.map((row) => row.id))) : [];
    const deliveriesByWebhook = new Map<string, WebhookDeliveryRow[]>();
    for (const delivery of deliveryRows) {
      const list = deliveriesByWebhook.get(delivery.webhookId) ?? [];
      list.push(delivery);
      deliveriesByWebhook.set(delivery.webhookId, list);
    }
    return listEnvelope(
      rows.map((row) =>
        toWireWebhook(
          row,
          names,
          (deliveriesByWebhook.get(row.id) ?? []).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20),
        ),
      ),
    );
  });

  app.post("/admin/integrations/webhooks", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "integrations.manage");
    const body = createWebhookSchema.parse(request.body);

    const issue = webhookUrlIssue(body.url);
    if (issue) throw apiError("validation", issue, { issues: [{ field: "url", message: issue }] });
    const knownEvents = new Set<string>(WEBHOOK_EVENTS);
    if (body.events.length === 0 || body.events.some((event) => !knownEvents.has(event))) {
      throw apiError("validation", "Escolha pelo menos um evento.", { issues: [{ field: "events", message: "Escolha pelo menos um evento." }] });
    }
    const url = body.url.trim();
    const [existing] = await db.select().from(adminWebhooks).where(eq(adminWebhooks.url, url)).limit(1);
    if (existing) throw apiError("validation", "Já existe um webhook para este endereço.", { issues: [{ field: "url", message: "Endereço repetido." }] });

    const secret = newOpaqueToken("whsec");
    const row = {
      id: newId("wh"),
      url,
      description: body.description.trim(),
      events: [...body.events],
      active: true,
      secretHash: hashOpaqueToken(secret),
      secretPreview: maskSecret(secret),
      createdAt: new Date(),
      createdByAccountId: admin.id,
    };
    await db.insert(adminWebhooks).values(row);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "integration.webhook_create",
      targetModule: "integration",
      targetId: row.id,
      targetLabel: row.url,
      reason: `Eventos: ${row.events.join(", ")}`,
    });

    const names = await accountNames([admin.id]);
    return dataEnvelope({ item: toWireWebhook(row as WebhookRow, names, []), secret });
  });

  app.post("/admin/integrations/webhooks/:id/active", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "integrations.manage");
    const { id } = request.params as { id: string };
    const body = setActiveSchema.parse(request.body);

    const [webhook] = await db.select().from(adminWebhooks).where(eq(adminWebhooks.id, id)).limit(1);
    if (!webhook) throw apiError("not_found", "Webhook não encontrado.");
    if (webhook.active === body.active) {
      throw apiError("invalid_transition", body.active ? "O webhook já está activo." : "O webhook já está desactivado.");
    }

    const [updated] = await db.update(adminWebhooks).set({ active: body.active }).where(eq(adminWebhooks.id, id)).returning();
    if (!updated) throw apiError("server", "Não foi possível actualizar o webhook.");

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "integration.webhook_toggle",
      targetModule: "integration",
      targetId: id,
      targetLabel: updated.url,
      changes: [{ field: "Estado", from: body.active ? "Desactivado" : "Activo", to: body.active ? "Activo" : "Desactivado" }],
    });

    const names = await accountNames([updated.createdByAccountId]);
    const deliveries = await db.select().from(adminWebhookDeliveries).where(eq(adminWebhookDeliveries.webhookId, id));
    return dataEnvelope(toWireWebhook(updated, names, deliveries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20)));
  });

  app.post("/admin/integrations/webhooks/:id/test", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "integrations.manage");
    const { id } = request.params as { id: string };

    const [webhook] = await db.select().from(adminWebhooks).where(eq(adminWebhooks.id, id)).limit(1);
    if (!webhook) throw apiError("not_found", "Webhook não encontrado.");
    if (!webhook.active) throw apiError("invalid_transition", "Active o webhook antes de o testar.");

    const delivery: typeof adminWebhookDeliveries.$inferInsert = {
      id: newId("whd"),
      webhookId: id,
      event: "ping",
      at: new Date(),
      status: "200",
      durationMs: 80 + Math.floor(Math.random() * 300),
      simulated: true,
    };
    await db.insert(adminWebhookDeliveries).values(delivery);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "integration.webhook_test",
      targetModule: "integration",
      targetId: id,
      targetLabel: webhook.url,
      reason: "Entrega simulada: nenhum pedido HTTP saiu do painel.",
    });

    return dataEnvelope(toWireDelivery(delivery as WebhookDeliveryRow));
  });
}
