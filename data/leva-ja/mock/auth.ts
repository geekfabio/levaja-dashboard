import { ROLE_LABELS } from "@/lib/leva-ja/permissions";
import { isTwoFactorRequired } from "@/lib/leva-ja/trust";
import type { AccessLogEntry, AdminSession, AdminUser } from "@/types/leva-ja";
import type { AdminAuthRepository } from "../repositories/admin-auth";
import { RepositoryError } from "../repositories/errors";
import type { MockDatabase } from "./database";
import { HOUR, isoAt } from "./domain";
import { initialsOf } from "./fixtures";
import { findOr404, requireReason } from "./helpers";
import { DEMO_ADMIN_CODE, DEMO_TOTP_CODE } from "./seed";

export const DEMO_IP = "196.249.104.18";
export const DEMO_DEVICE = "Navegador neste computador";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function createMockAuth(db: MockDatabase): AdminAuthRepository {
  return {
    requestCode: (email) =>
      db.open(() => {
        const normalized = normalizeEmail(email);
        if (!EMAIL_PATTERN.test(normalized)) {
          throw new RepositoryError("validation", "Indique um e-mail válido.", [{ field: "email", message: "Indique um e-mail válido." }]);
        }
        return { sentTo: maskEmail(normalized) };
      }),

    login: (email, code, otp) =>
      db.open(() => {
        const normalized = normalizeEmail(email);
        const user = db.state.adminUsers.find((item) => item.email === normalized);
        const nowIso = db.now().toISOString();
        const record = (result: AccessLogEntry["result"]) =>
          db.state.accessLog.unshift({ id: db.nextId("acc"), at: nowIso, email: normalized, userName: user?.name, result, ip: DEMO_IP, device: DEMO_DEVICE });
        if (!user || code.trim() !== DEMO_ADMIN_CODE) {
          record("wrong_code");
          db.persist();
          throw new RepositoryError("unauthorized", "E-mail ou código incorrecto.");
        }
        if (!user.active) {
          record("inactive");
          db.persist();
          throw new RepositoryError("unauthorized", "A sua conta está desactivada. Contacte um administrador.");
        }
        if (isTwoFactorRequired(user, db.state.settings.security)) {
          if (!otp?.trim()) {
            throw new RepositoryError("unauthorized", "Indique o código da aplicação de autenticação.", [{ field: "otp", message: "Indique o código de 6 dígitos da aplicação de autenticação." }]);
          }
          if (otp.trim() !== DEMO_TOTP_CODE) {
            record("two_factor_failed");
            db.persist();
            throw new RepositoryError("unauthorized", "Código de autenticação incorrecto.", [{ field: "otp", message: "Código de autenticação incorrecto." }]);
          }
        }
        const now = db.now().getTime();
        user.lastLoginAt = isoAt(now);
        const session: AdminSession = {
          token: `mock-${user.id}-${now.toString(36)}-${db.nextId("s")}`,
          user: { ...user },
          expiresAt: isoAt(now + db.state.settings.security.sessionHours * HOUR),
          rolePermissions: db.state.rolePermissions,
        };
        db.state.adminSessions.unshift({
          id: session.token,
          userId: user.id,
          userName: user.name,
          role: user.role,
          device: DEMO_DEVICE,
          ip: DEMO_IP,
          location: "Luanda",
          createdAt: isoAt(now),
          lastSeenAt: isoAt(now),
        });
        record("success");
        db.session = session;
        db.saveSession();
        db.audit(db.context(session), "session.login", { kind: "session", id: user.id, label: user.email });
        db.commit();
        db.flush();
        return session;
      }),

    currentSession: () =>
      db.open(() => {
        try {
          return db.requireSession();
        } catch {
          db.session = null;
          db.saveSession();
          return null;
        }
      }),

    logout: () =>
      db.open(() => {
        if (db.session) {
          const session = db.session;
          const record = db.state.adminSessions.find((item) => item.id === session.token);
          if (record && !record.revokedAt) {
            record.revokedAt = db.now().toISOString();
            record.revokedBy = session.user.name;
          }
          db.state.accessLog.unshift({ id: db.nextId("acc"), at: db.now().toISOString(), email: session.user.email, userName: session.user.name, result: "logout", ip: DEMO_IP, device: DEMO_DEVICE });
          db.audit(db.context(session), "session.logout", { kind: "session", id: session.user.id, label: session.user.email });
          db.commit();
          db.flush();
        }
        db.session = null;
        db.saveSession();
      }),

    listUsers: () =>
      db.run({ permission: "users.manage" }, ({ state }) =>
        [...state.adminUsers].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt")),
      ),

    createUser: (input, reason) =>
      db.run({ permission: "users.manage" }, (ctx) => {
        const why = requireReason(reason);
        const name = input.name.trim();
        const email = normalizeEmail(input.email);
        const issues = [];
        if (name.length < 3) issues.push({ field: "name", message: "Indique o nome completo." });
        if (!EMAIL_PATTERN.test(email)) issues.push({ field: "email", message: "Indique um e-mail válido." });
        if (ctx.state.adminUsers.some((user) => user.email === email)) {
          issues.push({ field: "email", message: "Já existe um utilizador com este e-mail." });
        }
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const user: AdminUser = {
          id: db.nextId("adm"),
          name,
          email,
          initials: initialsOf(name),
          role: input.role,
          active: true,
          createdAt: ctx.nowIso,
        };
        ctx.state.adminUsers.push(user);
        db.audit(ctx, "admin_user.create", { kind: "admin_user", id: user.id, label: user.name }, why, [
          { field: "Papel", from: "—", to: ROLE_LABELS[user.role] },
        ]);
        db.commit();
        return user;
      }),

    changeRole: (userId, role, reason) =>
      db.run({ permission: "users.manage" }, (ctx) => {
        const why = requireReason(reason);
        const user = findOr404(ctx.state.adminUsers, userId, "Utilizador");
        if (user.id === ctx.session.user.id) {
          throw new RepositoryError("validation", "Não pode alterar o seu próprio papel.");
        }
        if (user.role === role) throw new RepositoryError("validation", "O utilizador já tem este papel.");
        const from = user.role;
        user.role = role;
        db.audit(ctx, "admin_user.role", { kind: "admin_user", id: user.id, label: user.name }, why, [
          { field: "Papel", from: ROLE_LABELS[from], to: ROLE_LABELS[role] },
        ]);
        db.commit();
        return user;
      }),

    setActive: (userId, active, reason) =>
      db.run({ permission: "users.manage" }, (ctx) => {
        const why = requireReason(reason);
        const user = findOr404(ctx.state.adminUsers, userId, "Utilizador");
        if (user.id === ctx.session.user.id) {
          throw new RepositoryError("validation", "Não pode desactivar a sua própria conta.");
        }
        if (user.active === active) {
          throw new RepositoryError("validation", active ? "O utilizador já está activo." : "O utilizador já está desactivado.");
        }
        user.active = active;
        db.audit(ctx, active ? "admin_user.activate" : "admin_user.deactivate", { kind: "admin_user", id: user.id, label: user.name }, why, [
          { field: "Estado", from: active ? "Desactivado" : "Activo", to: active ? "Activo" : "Desactivado" },
        ]);
        db.commit();
        return user;
      }),
  };
}
