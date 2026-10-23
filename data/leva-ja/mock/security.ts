import { ROLE_LABELS } from "@/lib/leva-ja/permissions";
import type { SecurityRepository } from "../repositories/security";
import { RepositoryError } from "../repositories/errors";
import type { MockDatabase } from "./database";
import { DAY } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";

export function createMockSecurity(db: MockDatabase): SecurityRepository {
  const list = (now: number, token?: string) =>
    db.state.adminSessions
      .filter((record) => !record.revokedAt && Date.parse(record.lastSeenAt) > now - 30 * DAY)
      .sort(byNewest((record) => record.lastSeenAt))
      .map((record) => ({ ...record, current: record.id === token }));

  return {
    sessions: () => db.run({ permission: "security.manage" }, (ctx) => list(ctx.now.getTime(), ctx.session.token)),

    revokeSession: (id, reason) =>
      db.run({ permission: "security.manage" }, (ctx) => {
        const record = findOr404(ctx.state.adminSessions, id, "Sessão");
        if (record.id === ctx.session.token) throw new RepositoryError("validation", "Para terminar a sua própria sessão use «Terminar sessão».");
        if (record.revokedAt) throw new RepositoryError("invalid_transition", "A sessão já foi terminada.");
        const why = requireReason(reason, "o motivo");
        record.revokedAt = ctx.nowIso;
        record.revokedBy = ctx.session.user.name;
        const user = ctx.state.adminUsers.find((item) => item.id === record.userId);
        ctx.state.accessLog.unshift({ id: db.nextId("acc"), at: ctx.nowIso, email: user?.email ?? "", userName: record.userName, result: "revoked", ip: record.ip, device: record.device });
        db.audit(ctx, "security.session_revoke", { kind: "security", id: record.id, label: `${record.userName} · ${record.device}` }, why);
        db.commit("audit");
        return list(ctx.now.getTime(), ctx.session.token);
      }),

    accessLog: (filters = {}) =>
      db.run({ permission: "security.manage" }, ({ state }) =>
        paginate(
          state.accessLog
            .filter((entry) => (!filters.result?.length || filters.result.includes(entry.result)) && matchesQuery(filters.q, entry.email, entry.userName, entry.ip))
            .sort(byNewest((entry) => entry.at)),
          filters,
        ),
      ),

    setTwoFactor: (userId, enabled, reason) =>
      db.run({ permission: "security.manage" }, (ctx) => {
        const user = findOr404(ctx.state.adminUsers, userId, "Utilizador");
        if (Boolean(user.twoFactorEnabled) === enabled) throw new RepositoryError("invalid_transition", enabled ? "O segundo factor já está activo." : "O segundo factor já está desligado.");
        const why = requireReason(reason, "o motivo");
        user.twoFactorEnabled = enabled;
        db.audit(ctx, "security.two_factor", { kind: "admin_user", id: user.id, label: `${user.name} (${ROLE_LABELS[user.role]})` }, why, [
          { field: "Segundo factor", from: enabled ? "Desligado" : "Activo", to: enabled ? "Activo" : "Desligado" },
        ]);
        db.commit("audit");
        return { ...user };
      }),
  };
}
