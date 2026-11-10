import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts } from "../db/schema/auth";
import { disputes } from "../db/schema/disputes";
import { providers, serviceRequestEvents, serviceRequests, wallets, walletTransactions } from "../db/schema/ops";
import { penalties } from "../db/schema/quality";
import { authenticateAdmin } from "../lib/authenticate-admin";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { csvList, listPageEnvelope, pageQuerySchema, paginate } from "../lib/pagination";
import { recordAdminAudit } from "../lib/admin-audit";
import { PROVIDER_BUSY_STATUSES } from "../lib/request-state";
import { requireCsrf } from "../lib/require-csrf";
import { requirePermission } from "../lib/require-permission";
import { requireReason } from "../lib/require-reason";
import { loadSettings } from "./admin-settings";

type ProviderRow = typeof providers.$inferSelect;
type PenaltyRow = typeof penalties.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const COMPLETED_STATUSES = ["delivered", "paid", "rated"] as const;

const PENALTY_KINDS = ["warning", "fine", "suspension"] as const;
const QUALITY_FLAGS = ["low_rating", "cancellations", "late_arrivals", "disputes", "inactive"] as const;
type QualityFlag = (typeof QUALITY_FLAGS)[number];

const PENALTY_KIND_LABELS: Record<string, string> = { warning: "Advertência", fine: "Multa", suspension: "Suspensão temporária" };

const scoresQuerySchema = pageQuerySchema.extend({
  flag: z.string().optional(),
  fleet_id: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["score", "cancellations", "late"]).optional(),
});

const penaltiesQuerySchema = pageQuerySchema.extend({
  provider_id: z.string().optional(),
  kind: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

const penalizeBodySchema = z.object({
  kind: z.enum(PENALTY_KINDS),
  reason: z.string(),
  amount_kz: z.number().optional(),
  days: z.number().optional(),
});

const revokeBodySchema = z.object({ reason: z.string().optional() });

function matchesText(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field && field.toLowerCase().includes(needle));
}

function formatDateNumeric(value: Date) {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${value.getUTCFullYear()}`;
}

function penaltyIssues(input: { kind: (typeof PENALTY_KINDS)[number]; reason: string; amount_kz?: number; days?: number }) {
  const issues: { field: string; message: string }[] = [];
  if (input.reason.trim().length < 3) issues.push({ field: "reason", message: "Indique o motivo da penalização." });
  if (input.kind === "fine" && (!Number.isInteger(input.amount_kz) || (input.amount_kz ?? 0) <= 0)) {
    issues.push({ field: "amount_kz", message: "Indique o valor da multa em kwanzas." });
  }
  if (input.kind === "suspension" && (!Number.isInteger(input.days) || (input.days ?? 0) < 1 || (input.days ?? 0) > 90)) {
    issues.push({ field: "days", message: "A suspensão tem de durar entre 1 e 90 dias." });
  }
  return issues;
}

function isPenaltyActive(penalty: Pick<PenaltyRow, "kind" | "until" | "revokedAt">, now: number) {
  if (penalty.revokedAt) return false;
  if (penalty.kind === "suspension" && penalty.until) return penalty.until.getTime() > now;
  return true;
}

type QualityThresholds = { arrivalTargetMinutes: number; cancelLimit: number };

function qualityScore(
  input: { completed: number; cancelled: number; arrivals: number[]; ratings: number[]; disputes: number; joinedDaysAgo: number; active: boolean },
  thresholds: QualityThresholds,
) {
  const assigned = input.completed + input.cancelled;
  const cancellationRate = assigned ? input.cancelled / assigned : 0;
  const lateArrivals = input.arrivals.filter((minutes) => minutes > thresholds.arrivalTargetMinutes).length;
  const lateRate = input.arrivals.length ? lateArrivals / input.arrivals.length : 0;
  const averageArrivalMinutes = input.arrivals.length ? Math.round(input.arrivals.reduce((sum, value) => sum + value, 0) / input.arrivals.length) : null;
  const rating = input.ratings.length ? Math.round((input.ratings.reduce((sum, value) => sum + value, 0) / input.ratings.length) * 10) / 10 : null;
  const lowRatings = input.ratings.filter((value) => value <= 2).length;
  const penalty =
    Math.min(30, cancellationRate * 100 * 0.8) +
    Math.min(25, lateRate * 100 * 0.4) +
    Math.min(30, rating === null ? 0 : Math.max(0, 5 - rating) * 15) +
    Math.min(15, input.disputes * 5);
  const flags: QualityFlag[] = [];
  if (rating !== null && rating < 4 && input.ratings.length >= 3) flags.push("low_rating");
  if (input.cancelled >= thresholds.cancelLimit) flags.push("cancellations");
  if (input.arrivals.length >= 3 && lateRate > 0.25) flags.push("late_arrivals");
  if (input.disputes >= 2) flags.push("disputes");
  if (input.active && assigned === 0 && input.joinedDaysAgo > 30) flags.push("inactive");
  return { cancellationRate, lateArrivals, lateRate, averageArrivalMinutes, rating, lowRatings, score: Math.max(0, Math.min(100, Math.round(100 - penalty))), flags };
}

async function providerQuality(provider: ProviderRow, joinedAt: Date, providerName: string, now: number, thresholds: QualityThresholds) {
  const since = new Date(now - 30 * DAY_MS);
  const own = await db.select().from(serviceRequests).where(eq(serviceRequests.providerAccountId, provider.accountId));
  const recent = own.filter((row) => row.createdAt >= since);
  const requestIds = recent.map((row) => row.id);

  const events = requestIds.length ? await db.select().from(serviceRequestEvents).where(inArray(serviceRequestEvents.requestId, requestIds)) : [];
  const eventsByRequest = new Map<string, typeof events>();
  for (const event of events) {
    eventsByRequest.set(event.requestId, [...(eventsByRequest.get(event.requestId) ?? []), event]);
  }
  const arrivals = recent.flatMap((row) => {
    const requestEvents = eventsByRequest.get(row.id) ?? [];
    const assigned = requestEvents.find((event) => event.status === "assigned");
    const arrived = requestEvents.find((event) => event.status === "arrived");
    return assigned && arrived ? [Math.max(0, Math.round((arrived.at.getTime() - assigned.at.getTime()) / MINUTE_MS))] : [];
  });

  const completed = recent.filter((row) => (COMPLETED_STATUSES as readonly string[]).includes(row.status)).length;
  const cancelled = recent.filter((row) => row.status === "cancelled").length;
  const ratings = recent.flatMap((row) => (row.rating === null ? [] : [row.rating]));
  const disputeRows = requestIds.length ? await db.select().from(disputes).where(inArray(disputes.requestId, requestIds)) : [];

  const result = qualityScore(
    {
      completed,
      cancelled,
      arrivals,
      ratings,
      disputes: disputeRows.length,
      joinedDaysAgo: (now - joinedAt.getTime()) / DAY_MS,
      active: provider.accountStatus === "active",
    },
    thresholds,
  );

  const activePenalties = (await db.select().from(penalties).where(eq(penalties.providerAccountId, provider.accountId))).filter((row) => isPenaltyActive(row, now)).length;

  return {
    provider_id: provider.accountId,
    provider_name: providerName,
    account_status: provider.accountStatus,
    completed,
    cancelled,
    cancellation_rate: result.cancellationRate,
    late_arrivals: result.lateArrivals,
    late_rate: result.lateRate,
    average_arrival_minutes: result.averageArrivalMinutes,
    rating: result.rating,
    low_ratings: result.lowRatings,
    disputes: disputeRows.length,
    score: result.score,
    flags: result.flags,
    active_penalties: activePenalties,
  };
}

async function presentPenalty(row: PenaltyRow, providerName: string, createdByName: string, revokedByName: string | null) {
  return {
    id: row.id,
    provider_id: row.providerAccountId,
    provider_name: providerName,
    kind: row.kind,
    reason: row.reason,
    amount_kz: row.amountKz,
    days: row.days,
    until: row.until ? row.until.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    created_by: createdByName,
    revoked_at: row.revokedAt ? row.revokedAt.toISOString() : null,
    revoked_by: revokedByName,
    revoke_reason: row.revokeReason,
  };
}

async function findProviderOrNotFound(id: string): Promise<{ account: typeof accounts.$inferSelect; provider: ProviderRow }> {
  const [provider] = await db.select().from(providers).where(eq(providers.accountId, id)).limit(1);
  if (!provider) throw apiError("not_found", "Prestador não encontrado.");
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!account) throw apiError("not_found", "Prestador não encontrado.");
  return { account, provider };
}

async function findPenaltyOrNotFound(id: string): Promise<PenaltyRow> {
  const [row] = await db.select().from(penalties).where(eq(penalties.id, id)).limit(1);
  if (!row) throw apiError("not_found", "Penalização não encontrada.");
  return row;
}

async function accountName(accountId: string | null | undefined) {
  if (!accountId) return null;
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return row?.fullName ?? null;
}

async function syncPenaltyTransaction(penalty: PenaltyRow) {
  const transactionId = `tx-${penalty.id}`;
  const [existing] = await db.select().from(walletTransactions).where(eq(walletTransactions.id, transactionId)).limit(1);
  if (existing) {
    await db.delete(walletTransactions).where(eq(walletTransactions.id, transactionId));
    const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, penalty.providerAccountId)).limit(1);
    if (wallet) {
      await db.update(wallets).set({ balanceKz: wallet.balanceKz - existing.amountKz }).where(eq(wallets.providerAccountId, penalty.providerAccountId));
    }
  }
  if (penalty.kind !== "fine" || penalty.revokedAt || !penalty.amountKz) return;

  const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, penalty.providerAccountId)).limit(1);
  if (!wallet) {
    await db.insert(wallets).values({ providerAccountId: penalty.providerAccountId, balanceKz: -penalty.amountKz });
  } else {
    await db.update(wallets).set({ balanceKz: wallet.balanceKz - penalty.amountKz }).where(eq(wallets.providerAccountId, penalty.providerAccountId));
  }
  await db.insert(walletTransactions).values({
    id: transactionId,
    providerAccountId: penalty.providerAccountId,
    type: "adjustment",
    title: `Multa — ${penalty.reason}`,
    amountKz: -penalty.amountKz,
    status: "completed",
  });
}

export async function adminQualityRoutes(app: FastifyInstance) {
  app.get("/admin/quality", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const query = scoresQuerySchema.parse(request.query);
    const flagFilter = csvList(query.flag);
    if (flagFilter && !flagFilter.every((value) => (QUALITY_FLAGS as readonly string[]).includes(value))) {
      throw apiError("validation", "Sinalização de qualidade inválida.");
    }

    const settings = await loadSettings();
    const thresholds: QualityThresholds = {
      arrivalTargetMinutes: settings.dispatch.arrival_target_minutes,
      cancelLimit: settings.cancellation.provider_cancel_limit,
    };

    const providerRows = (await db.select().from(providers)).filter((row) => row.accountStatus !== "pending_approval");
    const accountRows = providerRows.length ? await db.select().from(accounts).where(inArray(accounts.id, providerRows.map((row) => row.accountId))) : [];
    const accountsById = new Map(accountRows.map((row) => [row.id, row]));
    const now = Date.now();

    const all = await Promise.all(
      providerRows.map((provider) => {
        const account = accountsById.get(provider.accountId);
        return providerQuality(provider, account?.createdAt ?? new Date(now), account?.fullName ?? "Prestador", now, thresholds);
      }),
    );

    const items = all
      .filter((item) => (!flagFilter?.length || flagFilter.some((flag) => item.flags.includes(flag as QualityFlag))) && matchesText(query.q, item.provider_name))
      .sort((a, b) => {
        if (query.sort === "cancellations") return b.cancellation_rate - a.cancellation_rate;
        if (query.sort === "late") return b.late_rate - a.late_rate;
        return a.score - b.score;
      });

    const activePenaltiesTotal = (await db.select().from(penalties)).filter((row) => isPenaltyActive(row, now)).length;
    const page = paginate(items, query);

    return {
      data: page.items,
      meta: {
        count: page.items.length,
        total: page.total,
        page: page.page,
        page_size: page.page_size,
        totals: {
          flagged: all.filter((item) => item.flags.length > 0).length,
          average_score: all.length ? Math.round(all.reduce((sum, item) => sum + item.score, 0) / all.length) : 0,
          active_penalties: activePenaltiesTotal,
        },
      },
    };
  });

  app.get("/admin/quality/:providerId", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const { providerId } = request.params as { providerId: string };
    const { account, provider } = await findProviderOrNotFound(providerId);

    const settings = await loadSettings();
    const thresholds: QualityThresholds = {
      arrivalTargetMinutes: settings.dispatch.arrival_target_minutes,
      cancelLimit: settings.cancellation.provider_cancel_limit,
    };

    return dataEnvelope(await providerQuality(provider, account.createdAt, account.fullName, Date.now(), thresholds));
  });

  app.get("/admin/penalties", { preHandler: [authenticateAdmin] }, async (request) => {
    requirePermission(request.adminAccount!.adminRole!, "providers.view");
    const query = penaltiesQuerySchema.parse(request.query);
    const kindFilter = csvList(query.kind);
    if (kindFilter && !kindFilter.every((value) => (PENALTY_KINDS as readonly string[]).includes(value))) {
      throw apiError("validation", "Tipo de penalização inválido.");
    }

    const now = Date.now();
    const rows = await db.select().from(penalties);
    const filtered = rows
      .filter((row) => !query.provider_id || row.providerAccountId === query.provider_id)
      .filter((row) => !kindFilter?.length || kindFilter.includes(row.kind))
      .filter((row) => query.active === undefined || isPenaltyActive(row, now) === (query.active === "true"))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const providerIds = [...new Set(filtered.map((row) => row.providerAccountId))];
    const createdByIds = [...new Set(filtered.map((row) => row.createdByAccountId))];
    const revokedByIds = filtered.flatMap((row) => (row.revokedByAccountId ? [row.revokedByAccountId] : []));
    const nameRows = await db.select().from(accounts).where(inArray(accounts.id, [...new Set([...providerIds, ...createdByIds, ...revokedByIds])]));
    const namesById = new Map(nameRows.map((row) => [row.id, row.fullName]));

    const page = paginate(filtered, query);
    const items = await Promise.all(
      page.items.map((row) =>
        presentPenalty(row, namesById.get(row.providerAccountId) ?? "Prestador", namesById.get(row.createdByAccountId) ?? "Sistema", row.revokedByAccountId ? namesById.get(row.revokedByAccountId) ?? null : null),
      ),
    );

    return listPageEnvelope({ ...page, items });
  });

  app.post("/admin/providers/:providerId/penalties", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "providers.penalize");
    const { providerId } = request.params as { providerId: string };
    const body = penalizeBodySchema.parse(request.body);

    const { account, provider } = await findProviderOrNotFound(providerId);
    if (provider.accountStatus === "pending_approval") throw apiError("invalid_transition", "O prestador ainda não foi aprovado.");

    const issues = penaltyIssues(body);
    if (issues.length) throw apiError("validation", issues[0]!.message, { issues });

    const now = new Date();
    const changes: { field: string; from: string; to: string }[] = [];
    let until: Date | null = null;

    if (body.kind === "suspension") {
      if (provider.accountStatus === "suspended") throw apiError("invalid_transition", "O prestador já está suspenso.");
      const busy = await db
        .select()
        .from(serviceRequests)
        .where(and(eq(serviceRequests.providerAccountId, providerId), inArray(serviceRequests.status, [...PROVIDER_BUSY_STATUSES])));
      if (busy.length > 0) throw apiError("validation", "O prestador tem um pedido em curso. Reatribua-o antes de suspender.");
      until = new Date(now.getTime() + (body.days ?? 1) * DAY_MS);
      changes.push({ field: "Estado da conta", from: "Activo", to: `Suspenso até ${formatDateNumeric(until)}` });
    }
    if (body.kind === "fine") changes.push({ field: "Carteira", from: "—", to: `−${body.amount_kz} Kz` });

    const [penalty] = await db
      .insert(penalties)
      .values({
        id: newId("pen"),
        providerAccountId: providerId,
        kind: body.kind,
        reason: body.reason.trim(),
        amountKz: body.kind === "fine" ? body.amount_kz : null,
        days: body.kind === "suspension" ? body.days : null,
        until,
        createdByAccountId: admin.id,
      })
      .returning();

    if (body.kind === "suspension") {
      await db
        .update(providers)
        .set({ accountStatus: "suspended", online: false, suspensionReason: `Suspensão temporária até ${formatDateNumeric(until!)}: ${penalty!.reason}` })
        .where(eq(providers.accountId, providerId));
    }
    await syncPenaltyTransaction(penalty!);

    const label = `${PENALTY_KIND_LABELS[penalty!.kind]} — ${account.fullName}${penalty!.amountKz ? ` · ${penalty!.amountKz} Kz` : ""}${penalty!.days ? ` · ${penalty!.days} dias` : ""}`;
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "penalty.issue",
      targetModule: "penalty",
      targetId: penalty!.id,
      targetLabel: label,
      reason: penalty!.reason,
      changes,
      sensitive: true,
    });

    return dataEnvelope(await presentPenalty(penalty!, account.fullName, admin.fullName, null));
  });

  app.post("/admin/penalties/:id/revoke", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    const admin = request.adminAccount!;
    requirePermission(admin.adminRole!, "providers.penalize");
    const { id } = request.params as { id: string };
    const body = revokeBodySchema.parse(request.body);

    const penalty = await findPenaltyOrNotFound(id);
    if (penalty.revokedAt) throw apiError("invalid_transition", "A penalização já foi anulada.");
    const why = requireReason(body.reason, "a anulação da penalização");

    await db.update(penalties).set({ revokedAt: new Date(), revokedByAccountId: admin.id, revokeReason: why }).where(eq(penalties.id, id));
    const updated = await findPenaltyOrNotFound(id);

    if (penalty.kind === "suspension") {
      const [provider] = await db.select().from(providers).where(eq(providers.accountId, penalty.providerAccountId)).limit(1);
      if (provider && provider.accountStatus === "suspended") {
        const now = Date.now();
        const otherActive = (await db.select().from(penalties).where(eq(penalties.providerAccountId, penalty.providerAccountId))).filter(
          (row) => row.id !== id && row.kind === "suspension" && isPenaltyActive(row, now),
        );
        if (otherActive.length === 0) {
          await db.update(providers).set({ accountStatus: "active", suspensionReason: null }).where(eq(providers.accountId, penalty.providerAccountId));
        }
      }
    }
    await syncPenaltyTransaction(updated);

    const providerName = await accountName(penalty.providerAccountId);
    const label = `${PENALTY_KIND_LABELS[penalty.kind]} — ${providerName ?? "Prestador"}${penalty.amountKz ? ` · ${penalty.amountKz} Kz` : ""}${penalty.days ? ` · ${penalty.days} dias` : ""}`;
    await recordAdminAudit({
      actorAccountId: admin.id,
      action: "penalty.revoke",
      targetModule: "penalty",
      targetId: id,
      targetLabel: label,
      reason: why,
      sensitive: true,
    });

    const createdByName = (await accountName(updated.createdByAccountId)) ?? "Sistema";
    return dataEnvelope(await presentPenalty(updated, providerName ?? "Prestador", createdByName, admin.fullName));
  });
}
