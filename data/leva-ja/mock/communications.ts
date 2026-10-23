import { formatDateTimeNumeric, formatNumber } from "@/lib/format";
import { BROADCAST_CHANNEL_LABELS, BROADCAST_STATUS_LABELS, broadcastIssues } from "@/lib/leva-ja/commerce";
import type { Broadcast } from "@/types/leva-ja";
import type { CommunicationsRepository } from "../repositories/communications";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY } from "./domain";
import { byNewest, findOr404, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

export function audienceOf(state: MockState, audience: Broadcast["audience"], now: number) {
  const since = new Date(now - 30 * DAY).toISOString();
  if (audience.kind === "clients") {
    const business = new Set(state.businessAccounts.flatMap((account) => account.clientIds));
    return state.clients.filter((client) => {
      if (client.blocked) return false;
      if (audience.zoneIds.length && !state.requests.some((request) => request.clientId === client.id && audience.zoneIds.includes(request.zoneId))) return false;
      if (audience.segment === "inactive_30") return !state.requests.some((request) => request.clientId === client.id && request.createdAt >= since);
      if (audience.segment === "new_30") return client.createdAt >= since;
      if (audience.segment === "business") return business.has(client.id);
      if (audience.segment === "online") return false;
      return true;
    }).map((client) => client.name);
  }
  return state.providers
    .filter((provider) => {
      if (provider.accountStatus === "pending_approval") return false;
      if (audience.zoneIds.length && !provider.zoneIds.some((zoneId) => audience.zoneIds.includes(zoneId))) return false;
      if (audience.segment === "online") return provider.availability === "online";
      if (audience.segment === "new_30") return provider.joinedAt >= since;
      if (audience.segment === "inactive_30") return !state.requests.some((request) => request.providerId === provider.id && request.createdAt >= since);
      if (audience.segment === "business") return Boolean(provider.fleetId);
      return true;
    })
    .map((provider) => provider.name);
}

export function createMockCommunications(db: MockDatabase): CommunicationsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.broadcasts, id, "Comunicação");
  const label = (broadcast: Broadcast) => `${broadcast.title} · ${BROADCAST_CHANNEL_LABELS[broadcast.channel]}`;
  const editable = (broadcast: Broadcast) => {
    if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
      throw new RepositoryError("invalid_transition", `A comunicação já está «${BROADCAST_STATUS_LABELS[broadcast.status].toLowerCase()}».`);
    }
  };

  return {
    list: (filters = {}) =>
      db.run({ permission: "communications.send" }, ({ state }) =>
        paginate(
          state.broadcasts
            .filter((broadcast) => (!filters.status?.length || filters.status.includes(broadcast.status)) && (!filters.channel?.length || filters.channel.includes(broadcast.channel)))
            .sort(byNewest((broadcast) => broadcast.sentAt ?? broadcast.scheduledFor ?? broadcast.createdAt)),
          filters,
        ),
      ),

    estimate: (audience) =>
      db.run({ permission: "communications.send" }, ({ state, now }) => {
        const names = audienceOf(state, audience, now.getTime());
        return { recipients: names.length, sample: names.slice(0, 5) };
      }),

    create: (input) =>
      db.run({ permission: "communications.send" }, (ctx) => {
        const issues = broadcastIssues(input);
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const broadcast: Broadcast = {
          id: db.nextId("com"),
          title: input.title.trim(),
          channel: input.channel,
          audience: { ...input.audience, zoneIds: [...input.audience.zoneIds] },
          subject: input.channel === "email" ? input.subject?.trim() : undefined,
          message: input.message.trim(),
          status: "draft",
          createdAt: ctx.nowIso,
          createdBy: ctx.session.user.name,
        };
        ctx.state.broadcasts.push(broadcast);
        db.audit(ctx, "broadcast.create", { kind: "broadcast", id: broadcast.id, label: label(broadcast) });
        db.commit("support");
        return broadcast;
      }),

    schedule: (id, at) =>
      db.run({ permission: "communications.send" }, (ctx) => {
        const broadcast = find(ctx, id);
        editable(broadcast);
        const when = Date.parse(at);
        if (Number.isNaN(when) || when <= ctx.now.getTime()) throw new RepositoryError("validation", "Escolha uma data e hora no futuro.", [{ field: "at", message: "Data no passado." }]);
        broadcast.status = "scheduled";
        broadcast.scheduledFor = new Date(when).toISOString();
        db.audit(ctx, "broadcast.schedule", { kind: "broadcast", id, label: label(broadcast) }, `Para ${formatDateTimeNumeric(broadcast.scheduledFor)}`);
        db.commit("support");
        return broadcast;
      }),

    send: (id) =>
      db.run({ permission: "communications.send" }, (ctx) => {
        const broadcast = find(ctx, id);
        editable(broadcast);
        const recipients = audienceOf(ctx.state, broadcast.audience, ctx.now.getTime()).length;
        if (recipients === 0) throw new RepositoryError("validation", "O público escolhido não tem destinatários.");
        const failureRate = broadcast.channel === "sms" ? 0.04 : broadcast.channel === "email" ? 0.06 : 0.02;
        const failed = Math.round(recipients * failureRate);
        broadcast.status = "sent";
        broadcast.sentAt = ctx.nowIso;
        broadcast.recipients = recipients;
        broadcast.failed = failed;
        broadcast.delivered = recipients - failed;
        db.audit(ctx, "broadcast.send", { kind: "broadcast", id, label: label(broadcast) }, `Simulação: ${formatNumber(recipients)} destinatários, nenhuma mensagem real enviada.`);
        db.commit("support");
        return broadcast;
      }),

    cancel: (id, reason) =>
      db.run({ permission: "communications.send" }, (ctx) => {
        const broadcast = find(ctx, id);
        editable(broadcast);
        const why = requireReason(reason, "o motivo");
        broadcast.status = "cancelled";
        broadcast.cancelReason = why;
        db.audit(ctx, "broadcast.cancel", { kind: "broadcast", id, label: label(broadcast) }, why);
        db.commit("support");
        return broadcast;
      }),
  };
}
