import { asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { platformSettings } from "../db/schema/admin";
import { accounts } from "../db/schema/auth";
import { emergencyContacts, reviewNotes, serviceRequests, sosAlerts, supportTicketMessages, supportTickets } from "../db/schema/ops";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { hasPermission, type AdminRole } from "../lib/admin-roles";
import { initialsOf } from "../lib/admin-users";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";

type TicketRow = typeof supportTickets.$inferSelect;
type TicketMessageRow = typeof supportTicketMessages.$inferSelect;
type SosRow = typeof sosAlerts.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;

const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const SOS_STATUSES = ["open", "acknowledged", "resolved"] as const;

const DEFAULT_FIRST_RESPONSE_HOURS: Record<(typeof TICKET_PRIORITIES)[number], number> = {
  urgent: 1,
  high: 4,
  medium: 12,
  low: 24,
};

const ticketsQuerySchema = pageQuerySchema.extend({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignee_id: z.string().optional(),
  q: z.string().optional(),
});
const assignBodySchema = z.object({ assignee_id: z.string() });
const replyBodySchema = z.object({ body: z.string().optional() });
const resolveBodySchema = z.object({ resolution: z.string().optional() });
const sosQuerySchema = z.object({ status: z.string().optional() });
const sosResolveBodySchema = z.object({ resolution: z.string().optional() });
const lowRatingsQuerySchema = pageQuerySchema.extend({ handled: z.enum(["true", "false"]).optional() });
const handleReviewBodySchema = z.object({ note: z.string().optional() });

const emergencyContactBodySchema = z.object({
  label: z.string().trim().min(1, "Indica um nome."),
  phone_number: z.string().trim().min(1, "Indica um número."),
  reason: z.string().optional(),
});

function presentEmergencyContact(row: typeof emergencyContacts.$inferSelect) {
  return { id: row.id, label: row.label, phone_number: row.phoneNumber };
}

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

async function loadAccount(id: string | null | undefined): Promise<AccountRow | undefined> {
  if (!id) return undefined;
  const [row] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return row;
}

async function loadTicketOrNotFound(id: string): Promise<TicketRow> {
  const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Ocorrência não encontrada.");
  return row;
}

async function loadSosOrNotFound(id: string): Promise<SosRow> {
  const [row] = await db.select().from(sosAlerts).where(eq(sosAlerts.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Alerta SOS não encontrado.");
  return row;
}

async function loadMessages(ticketId: string): Promise<TicketMessageRow[]> {
  return db.select().from(supportTicketMessages).where(eq(supportTicketMessages.ticketId, ticketId)).orderBy(asc(supportTicketMessages.at));
}

function presentMessage(message: TicketMessageRow) {
  return {
    id: message.id,
    author: message.author,
    author_name: message.authorName,
    body: message.body,
    at: message.at.toISOString(),
  };
}

async function presentTicket(ticket: TicketRow) {
  const [requester, assignee, messages] = await Promise.all([
    loadAccount(ticket.accountId),
    loadAccount(ticket.assigneeAccountId),
    loadMessages(ticket.id),
  ]);

  return {
    id: ticket.id,
    code: ticket.code,
    subject: ticket.subject ?? ticket.reason,
    status: ticket.status,
    priority: ticket.priority,
    requester_kind: requester?.kind === "provider" ? "provider" : "client",
    requester_id: ticket.accountId,
    requester_name: requester?.fullName ?? "—",
    request_id: ticket.requestId,
    assignee_id: ticket.assigneeAccountId,
    assignee_name: assignee?.fullName,
    messages: messages.map(presentMessage),
    created_at: ticket.createdAt.toISOString(),
    updated_at: ticket.updatedAt.toISOString(),
    resolved_at: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : undefined,
    resolution: ticket.resolution ?? undefined,
    satisfaction:
      ticket.satisfactionScore !== null
        ? { score: ticket.satisfactionScore, comment: ticket.satisfactionComment ?? undefined, at: ticket.satisfactionAt?.toISOString() }
        : undefined,
  };
}

async function presentSos(alert: SosRow) {
  const [raisedBy, handledBy, request] = await Promise.all([
    loadAccount(alert.accountId),
    loadAccount(alert.handledByAccountId),
    alert.requestId ? db.select().from(serviceRequests).where(eq(serviceRequests.id, alert.requestId)).limit(1) : Promise.resolve([]),
  ]);
  const requestRow = Array.isArray(request) ? request[0] : undefined;

  return {
    id: alert.id,
    request_id: alert.requestId,
    request_code: requestRow?.code ?? "",
    raised_by: raisedBy?.kind === "provider" ? "provider" : "client",
    raised_by_id: alert.accountId,
    raised_by_name: raisedBy?.fullName ?? "—",
    phone: raisedBy?.phone ?? "",
    coords: { lat: Number(alert.lat), lng: Number(alert.lng) },
    area: alert.area ?? "",
    message: alert.message ?? "",
    status: alert.status,
    created_at: alert.createdAt.toISOString(),
    acknowledged_at: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : undefined,
    resolved_at: alert.resolvedAt ? alert.resolvedAt.toISOString() : undefined,
    handled_by: handledBy?.fullName,
    resolution: alert.resolution ?? undefined,
  };
}

async function lowRatingItems() {
  const rated = await db.select().from(serviceRequests).where(inArray(serviceRequests.rating, [1, 2]));
  const notes = await db.select().from(reviewNotes);
  const noteByRequestId = new Map(notes.map((note) => [note.requestId, note]));

  const items = await Promise.all(
    rated.map(async (row) => {
      const [client, provider] = await Promise.all([loadAccount(row.clientAccountId), loadAccount(row.providerAccountId)]);
      const note = noteByRequestId.get(row.id);
      return {
        id: `rv-${row.id}`,
        request_id: row.id,
        request_code: row.code,
        author_name: client?.fullName ?? "Cliente",
        author_initials: client ? initialsOf(client.fullName) : "",
        rating: row.rating ?? 0,
        comment: row.review ?? "",
        at: row.updatedAt.toISOString(),
        provider_id: row.providerAccountId ?? undefined,
        provider_name: provider?.fullName,
        handled: Boolean(note),
        handled_note: note?.note,
      };
    }),
  );

  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

async function loadFirstResponseHours(): Promise<Record<(typeof TICKET_PRIORITIES)[number], number>> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, "settings")).limit(1);
  const value = row?.value as { support?: { firstResponseHours?: Partial<Record<string, number>> } } | undefined;
  const hours = value?.support?.firstResponseHours;
  if (!hours || typeof hours !== "object") return DEFAULT_FIRST_RESPONSE_HOURS;
  return {
    urgent: Number(hours.urgent) || DEFAULT_FIRST_RESPONSE_HOURS.urgent,
    high: Number(hours.high) || DEFAULT_FIRST_RESPONSE_HOURS.high,
    medium: Number(hours.medium) || DEFAULT_FIRST_RESPONSE_HOURS.medium,
    low: Number(hours.low) || DEFAULT_FIRST_RESPONSE_HOURS.low,
  };
}

function ticketResponseSla(
  ticket: { createdAt: Date; priority: (typeof TICKET_PRIORITIES)[number] },
  firstMessageAt: Date | undefined,
  hours: Record<(typeof TICKET_PRIORITIES)[number], number>,
  nowMs: number,
) {
  const budget = hours[ticket.priority] * 3_600_000;
  const due = ticket.createdAt.getTime() + budget;
  if (firstMessageAt) {
    return { responded: true, status: firstMessageAt.getTime() <= due ? ("met" as const) : ("breached" as const) };
  }
  const left = due - nowMs;
  return { responded: false, status: left < 0 ? ("breached" as const) : left < budget * 0.25 ? ("at_risk" as const) : ("pending" as const) };
}

export async function adminSupportRoutes(app: FastifyInstance) {
  app.get("/admin/support/assignees", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.tickets");

    const admins = await db.select().from(accounts).where(eq(accounts.kind, "admin"));
    const items = admins
      .filter((account) => account.active && account.adminRole && hasPermission(account.adminRole as AdminRole, "support.tickets"))
      .map((account) => ({ id: account.id, name: account.fullName, initials: initialsOf(account.fullName), role: account.adminRole }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));

    return dataEnvelope(items);
  });

  app.get("/admin/support/tickets", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.tickets");
    const query = ticketsQuerySchema.parse(request.query);

    const statusFilter = csvList(query.status);
    if (statusFilter && !statusFilter.every((value) => (TICKET_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de ocorrência inválido.");
    }
    const priorityFilter = csvList(query.priority);
    if (priorityFilter && !priorityFilter.every((value) => (TICKET_PRIORITIES as readonly string[]).includes(value))) {
      throw apiError("validation", "Prioridade inválida.");
    }

    const rows = await db.select().from(supportTickets);
    const filtered = rows.filter((row) => {
      if (statusFilter?.length && !statusFilter.includes(row.status)) return false;
      if (priorityFilter?.length && !priorityFilter.includes(row.priority)) return false;
      if (query.assignee_id && row.assigneeAccountId !== query.assignee_id) return false;
      return true;
    });
    const presented = await Promise.all(filtered.map(presentTicket));
    const matched = presented.filter((item) => matchesText(query.q, item.code, item.subject, item.requester_name));

    const statusOrder: Record<string, number> = { open: 0, in_progress: 1, resolved: 2 };
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    matched.sort(
      (a, b) =>
        statusOrder[a.status]! - statusOrder[b.status]! ||
        priorityOrder[a.priority]! - priorityOrder[b.priority]! ||
        (a.updated_at < b.updated_at ? 1 : -1),
    );

    return listPageEnvelope(paginate(matched, query));
  });

  app.get("/admin/support/tickets/:id", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.tickets");
    const { id } = request.params as { id: string };
    return dataEnvelope(await presentTicket(await loadTicketOrNotFound(id)));
  });

  app.post("/admin/support/tickets/:id/assign", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "support.tickets");
    const { id } = request.params as { id: string };
    const body = assignBodySchema.parse(request.body);

    const ticket = await loadTicketOrNotFound(id);
    if (ticket.status === "resolved") throw apiError("invalid_transition", "A ocorrência já está resolvida.");

    const target = await loadAccount(body.assignee_id);
    if (!target || target.kind !== "admin" || !target.active || !target.adminRole || !hasPermission(target.adminRole as AdminRole, "support.tickets")) {
      throw apiError("validation", "Este utilizador não pode tratar ocorrências.");
    }
    if (ticket.assigneeAccountId === target.id) {
      throw apiError("validation", "A ocorrência já está atribuída a este utilizador.");
    }

    const previousAssignee = await loadAccount(ticket.assigneeAccountId);
    const fromStatus = ticket.status;

    await db
      .update(supportTickets)
      .set({ assigneeAccountId: target.id, status: "in_progress", updatedAt: new Date() })
      .where(eq(supportTickets.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "ticket.assign",
      targetModule: "ticket",
      targetId: ticket.id,
      targetLabel: `${ticket.code} — ${ticket.subject ?? ticket.reason}`,
      changes: [
        { field: "Responsável", from: previousAssignee?.fullName ?? "—", to: target.fullName },
        ...(fromStatus !== "in_progress" ? [{ field: "Estado", from: fromStatus, to: "in_progress" }] : []),
      ],
    });

    return dataEnvelope(await presentTicket(await loadTicketOrNotFound(id)));
  });

  app.post("/admin/support/tickets/:id/reply", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "support.tickets");
    const { id } = request.params as { id: string };
    const body = replyBodySchema.parse(request.body);
    const text = requireReason(body.body, "a resposta");

    const ticket = await loadTicketOrNotFound(id);
    if (ticket.status === "resolved") throw apiError("invalid_transition", "A ocorrência já está resolvida.");

    await db.insert(supportTicketMessages).values({ id: newId("tmsg"), ticketId: ticket.id, author: "admin", authorName: admin.fullName, body: text });

    await db
      .update(supportTickets)
      .set({
        status: ticket.status === "open" ? "in_progress" : ticket.status,
        assigneeAccountId: ticket.assigneeAccountId ?? admin.id,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "ticket.reply",
      targetModule: "ticket",
      targetId: ticket.id,
      targetLabel: `${ticket.code} — ${ticket.subject ?? ticket.reason}`,
      reason: text,
    });

    return dataEnvelope(await presentTicket(await loadTicketOrNotFound(id)));
  });

  app.post("/admin/support/tickets/:id/resolve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "support.tickets");
    const { id } = request.params as { id: string };
    const body = resolveBodySchema.parse(request.body);
    const text = requireReason(body.resolution, "a resolução");

    const ticket = await loadTicketOrNotFound(id);
    if (ticket.status === "resolved") throw apiError("invalid_transition", "A ocorrência já está resolvida.");

    const from = ticket.status;
    const now = new Date();
    await db.update(supportTickets).set({ status: "resolved", resolution: text, resolvedAt: now, updatedAt: now }).where(eq(supportTickets.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "ticket.resolve",
      targetModule: "ticket",
      targetId: ticket.id,
      targetLabel: `${ticket.code} — ${ticket.subject ?? ticket.reason}`,
      reason: text,
      changes: [{ field: "Estado", from, to: "resolved" }],
    });

    return dataEnvelope(await presentTicket(await loadTicketOrNotFound(id)));
  });

  app.get("/admin/support/sos", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.sos");
    const query = sosQuerySchema.parse(request.query);
    const statusFilter = csvList(query.status);
    if (statusFilter && !statusFilter.every((value) => (SOS_STATUSES as readonly string[]).includes(value))) {
      throw apiError("validation", "Estado de alerta inválido.");
    }

    const rows = await db.select().from(sosAlerts).orderBy(desc(sosAlerts.createdAt));
    const filtered = rows.filter((row) => !statusFilter?.length || statusFilter.includes(row.status));
    return dataEnvelope(await Promise.all(filtered.map(presentSos)));
  });

  app.post("/admin/support/sos/:id/acknowledge", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "support.sos");
    const { id } = request.params as { id: string };

    const alert = await loadSosOrNotFound(id);
    if (alert.status !== "open") throw apiError("invalid_transition", "O alerta já está a ser acompanhado.");

    await db
      .update(sosAlerts)
      .set({ status: "acknowledged", acknowledgedAt: new Date(), handledByAccountId: admin.id })
      .where(eq(sosAlerts.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "sos.acknowledge",
      targetModule: "sos",
      targetId: alert.id,
      targetLabel: `SOS ${alert.id}`,
      reason: "Alerta em acompanhamento.",
    });

    return dataEnvelope(await presentSos(await loadSosOrNotFound(id)));
  });

  app.post("/admin/support/sos/:id/resolve", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "support.sos");
    const { id } = request.params as { id: string };
    const body = sosResolveBodySchema.parse(request.body);
    const text = requireReason(body.resolution, "a resolução");

    const alert = await loadSosOrNotFound(id);
    if (alert.status === "resolved") throw apiError("invalid_transition", "O alerta já está resolvido.");

    const now = new Date();
    await db
      .update(sosAlerts)
      .set({ status: "resolved", acknowledgedAt: alert.acknowledgedAt ?? now, resolvedAt: now, resolution: text, handledByAccountId: admin.id })
      .where(eq(sosAlerts.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "sos.resolve",
      targetModule: "sos",
      targetId: alert.id,
      targetLabel: `SOS ${alert.id}`,
      reason: text,
    });

    return dataEnvelope(await presentSos(await loadSosOrNotFound(id)));
  });

  app.get("/admin/support/low-ratings", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.reviews");
    const query = lowRatingsQuerySchema.parse(request.query);

    const items = await lowRatingItems();
    const filtered = query.handled === undefined ? items : items.filter((item) => item.handled === (query.handled === "true"));

    return listPageEnvelope(paginate(filtered, query));
  });

  app.post("/admin/support/low-ratings/:id/handle", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "support.reviews");
    const { id } = request.params as { id: string };
    const body = handleReviewBodySchema.parse(request.body);
    const note = requireReason(body.note, "uma nota sobre a revisão");

    const items = await lowRatingItems();
    const item = items.find((entry) => entry.id === id);
    if (!item) throw apiError("not_found", "Avaliação não encontrada.");
    if (item.handled) throw apiError("invalid_transition", "Esta avaliação já foi revista.");

    await db.insert(reviewNotes).values({ id, requestId: item.request_id, note, handledByAccountId: admin.id });

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "review.handled",
      targetModule: "review",
      targetId: id,
      targetLabel: `${item.request_code} — ${item.rating} estrela(s)`,
      reason: note,
    });

    const updated = await lowRatingItems();
    return dataEnvelope(updated.find((entry) => entry.id === id));
  });

  app.get("/admin/support/response-summary", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.tickets");

    const [tickets, hours] = await Promise.all([db.select().from(supportTickets), loadFirstResponseHours()]);
    const now = Date.now();
    const results = await Promise.all(
      tickets.map(async (ticket) => {
        const messages = await loadMessages(ticket.id);
        const firstAdminMessage = messages.find((message) => message.author === "admin")?.at;
        return ticketResponseSla(ticket, firstAdminMessage, hours, now);
      }),
    );
    const answered = results.filter((result) => result.responded);

    return dataEnvelope({
      pending: results.filter((result) => !result.responded && result.status === "pending").length,
      at_risk: results.filter((result) => !result.responded && result.status === "at_risk").length,
      breached: results.filter((result) => !result.responded && result.status === "breached").length,
      met_rate: answered.length ? answered.filter((result) => result.status === "met").length / answered.length : null,
    });
  });

  app.get("/admin/support/satisfaction", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "support.tickets");

    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.status, "resolved"));
    const rated = tickets.filter((ticket) => ticket.satisfactionScore !== null);
    const scores = rated.map((ticket) => ticket.satisfactionScore ?? 0);
    const average = scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null;
    const satisfiedRate = scores.length ? scores.filter((value) => value >= 4).length / scores.length : null;

    const recent = await Promise.all(
      [...rated]
        .sort((a, b) => {
          const atA = (a.satisfactionAt ?? a.updatedAt).getTime();
          const atB = (b.satisfactionAt ?? b.updatedAt).getTime();
          return atB - atA;
        })
        .slice(0, 10)
        .map(async (ticket) => {
          const requester = await loadAccount(ticket.accountId);
          return {
            ticket_id: ticket.id,
            ticket_code: ticket.code,
            requester_name: requester?.fullName ?? "—",
            score: ticket.satisfactionScore ?? 0,
            comment: ticket.satisfactionComment ?? undefined,
            at: (ticket.satisfactionAt ?? ticket.updatedAt).toISOString(),
          };
        }),
    );

    return dataEnvelope({
      responses: scores.length,
      average,
      satisfied_rate: satisfiedRate,
      response_rate: tickets.length ? rated.length / tickets.length : null,
      recent,
    });
  });

  app.get("/admin/support/emergency-contacts", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole! as AdminRole, "support.sos");
    const rows = await db.select().from(emergencyContacts).orderBy(asc(emergencyContacts.label));
    return dataEnvelope(rows.map(presentEmergencyContact));
  });

  app.post("/admin/support/emergency-contacts", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole! as AdminRole, "support.sos");
    const body = emergencyContactBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo");

    const [row] = await db.insert(emergencyContacts).values({ id: newId("emc"), label: body.label, phoneNumber: body.phone_number }).returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "support.emergency_contact.create",
      targetModule: "support",
      targetId: row!.id,
      targetLabel: row!.label,
      reason,
      changes: [{ field: "Contacto", from: "—", to: `${row!.label}: ${row!.phoneNumber}` }],
      sensitive: true,
    });

    return dataEnvelope(presentEmergencyContact(row!));
  });

  app.patch("/admin/support/emergency-contacts/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole! as AdminRole, "support.sos");
    const { id } = request.params as { id: string };
    const body = emergencyContactBodySchema.parse(request.body);
    const reason = requireReason(body.reason, "o motivo");

    const [existing] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id)).limit(1);
    if (!existing) throw apiError("not_found", "Contacto não encontrado.");

    const [row] = await db
      .update(emergencyContacts)
      .set({ label: body.label, phoneNumber: body.phone_number })
      .where(eq(emergencyContacts.id, id))
      .returning();

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "support.emergency_contact.update",
      targetModule: "support",
      targetId: row!.id,
      targetLabel: row!.label,
      reason,
      changes: [{ field: "Contacto", from: `${existing.label}: ${existing.phoneNumber}`, to: `${row!.label}: ${row!.phoneNumber}` }],
      sensitive: true,
    });

    return dataEnvelope(presentEmergencyContact(row!));
  });

  app.delete("/admin/support/emergency-contacts/:id", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole! as AdminRole, "support.sos");
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().optional() }).parse(request.body ?? {});
    const reason = requireReason(body.reason, "o motivo");

    const [existing] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id)).limit(1);
    if (!existing) throw apiError("not_found", "Contacto não encontrado.");

    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));

    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "support.emergency_contact.remove",
      targetModule: "support",
      targetId: id,
      targetLabel: existing.label,
      reason,
      changes: [{ field: "Contacto", from: `${existing.label}: ${existing.phoneNumber}`, to: "—" }],
      sensitive: true,
    });

    return dataEnvelope(null);
  });
}
