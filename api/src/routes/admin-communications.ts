import { desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { broadcasts } from "../db/schema/admin";
import { accounts } from "../db/schema/auth";
import { clients, providers, serviceRequests, zones } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { recordAdminAudit } from "../lib/admin-audit";
import { apiError, dataEnvelope } from "../lib/envelope";
import { haversineKm } from "../lib/geo";
import { newId } from "../lib/ids";
import { sendMail } from "../lib/mailer";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type BroadcastRow = typeof broadcasts.$inferSelect;
type BroadcastChannel = "push" | "sms" | "email";
type BroadcastStatus = "draft" | "scheduled" | "sent" | "cancelled";
type BroadcastAudienceKind = "clients" | "providers";
type BroadcastAudienceSegment = "all" | "inactive_30" | "new_30" | "online" | "business";

const DAY_MS = 86_400_000;

const BROADCAST_CHANNELS: readonly BroadcastChannel[] = ["push", "sms", "email"];
const BROADCAST_STATUSES: readonly BroadcastStatus[] = ["draft", "scheduled", "sent", "cancelled"];
const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sent: "Envio simulado",
  cancelled: "Cancelada",
};
const BROADCAST_CHANNEL_LABELS: Record<BroadcastChannel, string> = { push: "Notificação na app", sms: "SMS", email: "E-mail" };

const audienceSchema = z.object({
  kind: z.enum(["clients", "providers"]),
  segment: z.enum(["all", "inactive_30", "new_30", "online", "business"]),
  zone_ids: z.array(z.string()).default([]),
});

const listQuerySchema = pageQuerySchema.extend({
  status: z.string().optional(),
  channel: z.string().optional(),
});

const createSchema = z.object({
  title: z.string(),
  channel: z.enum(["push", "sms", "email"]),
  audience: audienceSchema,
  subject: z.string().optional(),
  message: z.string(),
});

const estimateSchema = z.object({ audience: audienceSchema });
const scheduleSchema = z.object({ at: z.string() });
const cancelSchema = z.object({ reason: z.string().optional() });

function smsParts(text: string) {
  const length = [...text].length;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}

function broadcastIssues(input: { title: string; channel: BroadcastChannel; subject?: string; message: string }) {
  const issues: { field: string; message: string }[] = [];
  if (input.title.trim().length < 3) issues.push({ field: "title", message: "Indique um título interno." });
  if (input.message.trim().length < 10) issues.push({ field: "message", message: "A mensagem tem de ter pelo menos 10 caracteres." });
  if (input.channel === "sms" && smsParts(input.message) > 3) issues.push({ field: "message", message: "Um SMS não pode passar 3 partes (459 caracteres)." });
  if (input.channel === "push" && [...input.message].length > 240) issues.push({ field: "message", message: "Uma notificação não pode passar 240 caracteres." });
  if (input.channel === "email" && (input.subject ?? "").trim().length < 3) issues.push({ field: "subject", message: "Indique o assunto do e-mail." });
  return issues;
}

type AudienceInput = { kind: BroadcastAudienceKind; segment: BroadcastAudienceSegment; zoneIds: string[] };
type Recipient = { id: string; name: string; email: string };

async function resolveAudience(audience: AudienceInput, now: Date): Promise<Recipient[]> {
  if (audience.segment === "business") return [];
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const zoneRows = audience.zoneIds.length ? await db.select().from(zones).where(inArray(zones.id, audience.zoneIds)) : [];
  const zoneCircles = zoneRows.map((zone) => ({ lat: Number(zone.lat), lng: Number(zone.lng), radiusKm: Number(zone.radiusKm) }));

  if (audience.kind === "clients") {
    if (audience.segment === "online") return [];
    const rows = await db
      .select({ id: accounts.id, name: accounts.fullName, email: accounts.email, createdAt: accounts.createdAt, blocked: clients.blocked })
      .from(clients)
      .innerJoin(accounts, eq(accounts.id, clients.accountId));

    const needsRequests = zoneCircles.length > 0 || audience.segment === "inactive_30";
    const requestRows = needsRequests ? await db.select().from(serviceRequests) : [];

    return rows
      .filter((row) => {
        if (row.blocked) return false;
        if (zoneCircles.length > 0) {
          const inZone = requestRows.some((request) => {
            if (request.clientAccountId !== row.id) return false;
            const pickup = request.pickup as { lat?: number; lng?: number } | null;
            if (!pickup?.lat || !pickup?.lng) return false;
            return zoneCircles.some((circle) => haversineKm({ lat: pickup.lat!, lng: pickup.lng! }, circle) <= circle.radiusKm);
          });
          if (!inZone) return false;
        }
        if (audience.segment === "inactive_30") {
          const hasRecent = requestRows.some((request) => request.clientAccountId === row.id && request.createdAt.getTime() >= since.getTime());
          if (hasRecent) return false;
        }
        if (audience.segment === "new_30" && row.createdAt.getTime() < since.getTime()) return false;
        return true;
      })
      .map((row) => ({ id: row.id, name: row.name, email: row.email }));
  }

  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.fullName,
      email: accounts.email,
      createdAt: accounts.createdAt,
      online: providers.online,
      accountStatus: providers.accountStatus,
      coverageZoneIds: providers.coverageZoneIds,
    })
    .from(providers)
    .innerJoin(accounts, eq(accounts.id, providers.accountId));

  const needsRequests = audience.segment === "inactive_30";
  const requestRows = needsRequests ? await db.select().from(serviceRequests) : [];

  return rows
    .filter((row) => {
      if (row.accountStatus === "pending_approval") return false;
      if (audience.zoneIds.length > 0 && !row.coverageZoneIds.some((zoneId) => audience.zoneIds.includes(zoneId))) return false;
      if (audience.segment === "online") return row.online;
      if (audience.segment === "new_30") return row.createdAt.getTime() >= since.getTime();
      if (audience.segment === "inactive_30") {
        return !requestRows.some((request) => request.providerAccountId === row.id && request.createdAt.getTime() >= since.getTime());
      }
      return true;
    })
    .map((row) => ({ id: row.id, name: row.name, email: row.email }));
}

function toWireBroadcast(row: BroadcastRow) {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    audience: { kind: row.audienceKind, segment: row.audienceSegment, zone_ids: row.audienceZoneIds },
    subject: row.subject ?? undefined,
    message: row.message,
    status: row.status,
    scheduled_for: row.scheduledFor?.toISOString(),
    sent_at: row.sentAt?.toISOString(),
    recipients: row.recipients ?? undefined,
    delivered: row.delivered ?? undefined,
    failed: row.failed ?? undefined,
    created_at: row.createdAt.toISOString(),
    created_by: row.createdByAccountId,
    cancel_reason: row.cancelReason ?? undefined,
  };
}

function label(row: Pick<BroadcastRow, "title" | "channel">) {
  return `${row.title} · ${BROADCAST_CHANNEL_LABELS[row.channel as BroadcastChannel]}`;
}

function requireEditable(row: BroadcastRow) {
  if (row.status !== "draft" && row.status !== "scheduled") {
    throw apiError("invalid_transition", `A comunicação já está «${BROADCAST_STATUS_LABELS[row.status as BroadcastStatus].toLowerCase()}».`);
  }
}

export async function adminCommunicationsRoutes(app: FastifyInstance) {
  app.get("/admin/communications", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "communications.send");
    const query = listQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status)?.filter((item): item is BroadcastStatus => (BROADCAST_STATUSES as readonly string[]).includes(item));
    const channelFilter = csvList(query.channel)?.filter((item): item is BroadcastChannel => (BROADCAST_CHANNELS as readonly string[]).includes(item));

    const rows = await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt));
    const filtered = rows.filter(
      (row) => (!statusFilter?.length || statusFilter.includes(row.status)) && (!channelFilter?.length || channelFilter.includes(row.channel)),
    );

    return listPageEnvelope(paginate(filtered.map(toWireBroadcast), query));
  });

  app.post("/admin/communications/estimate", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "communications.send");
    const body = estimateSchema.parse(request.body);
    const recipients = await resolveAudience({ kind: body.audience.kind, segment: body.audience.segment, zoneIds: body.audience.zone_ids }, new Date());
    return dataEnvelope({ recipients: recipients.length, sample: recipients.slice(0, 5).map((recipient) => recipient.name) });
  });

  app.post("/admin/communications", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "communications.send");
    const body = createSchema.parse(request.body);

    const issues = broadcastIssues(body);
    if (issues.length) throw apiError("validation", issues[0]!.message, { issues });

    const id = newId("com");
    const row = {
      id,
      title: body.title.trim(),
      channel: body.channel,
      audienceKind: body.audience.kind,
      audienceSegment: body.audience.segment,
      audienceZoneIds: [...body.audience.zone_ids],
      subject: body.channel === "email" ? body.subject?.trim() : undefined,
      message: body.message.trim(),
      status: "draft" as const,
      createdAt: new Date(),
      createdByAccountId: admin.id,
    };
    await db.insert(broadcasts).values(row);

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "broadcast.create",
      targetModule: "broadcast",
      targetId: id,
      targetLabel: label(row),
    });

    const [created] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
    return dataEnvelope(toWireBroadcast(created!));
  });

  app.post("/admin/communications/:id/schedule", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "communications.send");
    const { id } = request.params as { id: string };
    const body = scheduleSchema.parse(request.body);

    const [row] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
    if (!row) throw apiError("not_found", "Comunicação não encontrada.");
    requireEditable(row);

    const when = Date.parse(body.at);
    if (Number.isNaN(when) || when <= Date.now()) {
      throw apiError("validation", "Escolha uma data e hora no futuro.", { issues: [{ field: "at", message: "Data no passado." }] });
    }

    const [updated] = await db
      .update(broadcasts)
      .set({ status: "scheduled", scheduledFor: new Date(when) })
      .where(eq(broadcasts.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível agendar a comunicação.");

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "broadcast.schedule",
      targetModule: "broadcast",
      targetId: id,
      targetLabel: label(updated),
      reason: `Para ${updated.scheduledFor?.toISOString()}`,
    });

    return dataEnvelope(toWireBroadcast(updated));
  });

  app.post("/admin/communications/:id/send", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "communications.send");
    const { id } = request.params as { id: string };

    const [row] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
    if (!row) throw apiError("not_found", "Comunicação não encontrada.");
    requireEditable(row);

    const recipients = await resolveAudience({ kind: row.audienceKind, segment: row.audienceSegment, zoneIds: row.audienceZoneIds }, new Date());
    if (recipients.length === 0) throw apiError("validation", "O público escolhido não tem destinatários.");

    const failureRate = row.channel === "sms" ? 0.04 : row.channel === "email" ? 0.06 : 0.02;
    const failed = Math.round(recipients.length * failureRate);
    const delivered = recipients.length - failed;

    if (row.channel === "email") {
      for (const recipient of recipients) {
        await sendMail({ to: recipient.email, subject: row.subject ?? row.title, body: row.message }, request.log);
      }
    }

    const [updated] = await db
      .update(broadcasts)
      .set({ status: "sent", sentAt: new Date(), recipients: recipients.length, delivered, failed })
      .where(eq(broadcasts.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível enviar a comunicação.");

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "broadcast.send",
      targetModule: "broadcast",
      targetId: id,
      targetLabel: label(updated),
      reason: `Simulação: ${recipients.length} destinatário(s), nenhuma mensagem real enviada.`,
      sensitive: true,
    });

    return dataEnvelope(toWireBroadcast(updated));
  });

  app.post("/admin/communications/:id/cancel", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "communications.send");
    const { id } = request.params as { id: string };
    const body = cancelSchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo");

    const [row] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
    if (!row) throw apiError("not_found", "Comunicação não encontrada.");
    requireEditable(row);

    const [updated] = await db
      .update(broadcasts)
      .set({ status: "cancelled", cancelReason: reason })
      .where(eq(broadcasts.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível cancelar a comunicação.");

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "broadcast.cancel",
      targetModule: "broadcast",
      targetId: id,
      targetLabel: label(updated),
      reason,
    });

    return dataEnvelope(toWireBroadcast(updated));
  });
}
