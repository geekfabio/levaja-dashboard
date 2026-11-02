import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/client";
import { loadEnv } from "../env";
import { apiError, dataEnvelope, listEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { isValidEmail, maskEmail, normalizeEmail } from "../lib/email";
import { generateOtpCode, hashOtpCode, OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES } from "../lib/otp";
import { sendMail } from "../lib/mailer";
import { ADMIN_SESSION_COOKIE, authenticateAdmin, loadAdminSession } from "../lib/authenticate-admin";
import { requireCsrf } from "../lib/require-csrf";
import { computeCsrfToken, newCsrfSecret } from "../lib/csrf";
import { DEFAULT_ROLE_PERMISSIONS, isAdminRole, requireAdminRole, ROLE_LABELS, type AdminRole } from "../lib/admin-roles";
import { toWireAdminUser } from "../lib/admin-users";
import { recordAdminAudit } from "../lib/admin-audit";
import { requireReason } from "../lib/require-reason";

const requestCodeBody = z.object({ email: z.string() });
const loginBody = z.object({ email: z.string(), code: z.string(), otp: z.string().optional() });
const createUserBody = z.object({ name: z.string(), email: z.string(), role: z.string(), reason: z.string().optional() });
const changeRoleBody = z.object({ role: z.string(), reason: z.string().optional() });
const setActiveBody = z.object({ active: z.boolean(), reason: z.string().optional() });

function genericLoginError() {
  return apiError("unauthorized", "E-mail ou código incorrecto.");
}

async function lastLoginMap(accountIds: string[]) {
  const map = new Map<string, Date>();
  if (accountIds.length === 0) return map;
  const sessions = await db
    .select({ accountId: schema.adminSessions.accountId, createdAt: schema.adminSessions.createdAt })
    .from(schema.adminSessions)
    .where(inArray(schema.adminSessions.accountId, accountIds));
  for (const row of sessions) {
    const current = map.get(row.accountId);
    if (!current || row.createdAt > current) map.set(row.accountId, row.createdAt);
  }
  return map;
}

export async function adminAuthRoutes(app: FastifyInstance) {
  const env = loadEnv();
  const sessionTtlMs = env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000;

  app.post("/admin/auth/request-code", async (request) => {
    const { email } = requestCodeBody.parse(request.body);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw apiError("validation", "Indique um e-mail válido.", { issues: [{ field: "email", message: "Indique um e-mail válido." }] });
    }

    const [account] = await db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.email, normalized), eq(schema.accounts.kind, "admin")))
      .limit(1);

    const code = generateOtpCode();
    await db.insert(schema.otpCodes).values({
      id: newId("otp"),
      accountId: account?.id,
      email: normalized,
      purpose: "admin_login",
      codeHash: hashOtpCode(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });

    await sendMail({
      to: normalized,
      subject: "Código de acesso ao painel AngoLeva",
      body: `O seu código de acesso é ${code}. Expira em ${OTP_TTL_MINUTES} minutos. Se não pediu este código, ignore este e-mail.`,
    });

    return dataEnvelope({ sent_to: maskEmail(normalized) });
  });

  app.post("/admin/auth/login", async (request, reply) => {
    const { email, code } = loginBody.parse(request.body);
    const normalized = normalizeEmail(email);

    const [otpRow] = await db
      .select()
      .from(schema.otpCodes)
      .where(and(eq(schema.otpCodes.email, normalized), eq(schema.otpCodes.purpose, "admin_login")))
      .orderBy(desc(schema.otpCodes.createdAt))
      .limit(1);

    if (!otpRow || otpRow.consumedAt) {
      throw genericLoginError();
    }
    if (otpRow.expiresAt.getTime() <= Date.now()) {
      await db.update(schema.otpCodes).set({ consumedAt: new Date() }).where(eq(schema.otpCodes.id, otpRow.id));
      throw apiError("unauthorized", "O código expirou. Peça um novo código.");
    }
    if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
      await db.update(schema.otpCodes).set({ consumedAt: new Date() }).where(eq(schema.otpCodes.id, otpRow.id));
      throw genericLoginError();
    }

    if (hashOtpCode(code) !== otpRow.codeHash) {
      const attempts = otpRow.attempts + 1;
      await db
        .update(schema.otpCodes)
        .set({ attempts, consumedAt: attempts >= OTP_MAX_ATTEMPTS ? new Date() : null })
        .where(eq(schema.otpCodes.id, otpRow.id));
      throw genericLoginError();
    }

    await db.update(schema.otpCodes).set({ consumedAt: new Date() }).where(eq(schema.otpCodes.id, otpRow.id));

    const [account] = await db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.email, normalized), eq(schema.accounts.kind, "admin")))
      .limit(1);

    if (!account || !account.adminRole) {
      throw genericLoginError();
    }
    if (!account.active) {
      throw apiError("unauthorized", "A sua conta está desactivada. Contacte um administrador.");
    }

    const now = new Date();
    const sessionRow = {
      id: newId("asess"),
      accountId: account.id,
      csrfSecret: newCsrfSecret(),
      ip: request.ip,
      userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
      expiresAt: new Date(now.getTime() + sessionTtlMs),
    };
    await db.insert(schema.adminSessions).values(sessionRow);

    reply.cookie(ADMIN_SESSION_COOKIE, sessionRow.id, {
      signed: true,
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: Math.round(sessionTtlMs / 1000),
    });

    await recordAdminAudit({
      actorAccountId: account.id,
      action: "session.login",
      targetModule: "session",
      targetId: account.id,
      targetLabel: account.email,
    });

    return dataEnvelope({
      token: sessionRow.id,
      user: toWireAdminUser(account, now),
      expires_at: sessionRow.expiresAt.toISOString(),
      role_permissions: DEFAULT_ROLE_PERMISSIONS,
      csrf_token: computeCsrfToken(sessionRow.csrfSecret),
    });
  });

  app.get("/admin/auth/session", async (request) => {
    const result = await loadAdminSession(request);
    if (!result) return dataEnvelope(null);

    const lastLoginByAccount = await lastLoginMap([result.account.id]);
    return dataEnvelope({
      token: result.session.id,
      user: toWireAdminUser(result.account, lastLoginByAccount.get(result.account.id)),
      expires_at: result.session.expiresAt.toISOString(),
      role_permissions: DEFAULT_ROLE_PERMISSIONS,
    });
  });

  app.post("/admin/auth/logout", { preHandler: [authenticateAdmin, requireCsrf] }, async (request, reply) => {
    const session = request.adminSession!;
    const account = request.adminAccount!;
    if (!session.revokedAt) {
      await db.update(schema.adminSessions).set({ revokedAt: new Date() }).where(eq(schema.adminSessions.id, session.id));
      await recordAdminAudit({
        actorAccountId: account.id,
        action: "session.logout",
        targetModule: "session",
        targetId: account.id,
        targetLabel: account.email,
      });
    }
    reply.clearCookie(ADMIN_SESSION_COOKIE, { path: "/" });
    return dataEnvelope(null);
  });

  app.get("/admin/users", { preHandler: [authenticateAdmin] }, async (request) => {
    requireAdminRole(request.adminAccount!.adminRole as AdminRole);

    const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.kind, "admin"));
    const lastLoginByAccount = await lastLoginMap(accounts.map((item) => item.id));
    const users = accounts
      .map((account) => toWireAdminUser(account, lastLoginByAccount.get(account.id)))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt"));

    return listEnvelope(users);
  });

  app.post("/admin/users", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    requireAdminRole(request.adminAccount!.adminRole as AdminRole);

    const body = createUserBody.parse(request.body);
    const reason = requireReason(body.reason);
    const name = body.name.trim();
    const email = normalizeEmail(body.email);
    const role = body.role;

    if (name.length < 3) {
      throw apiError("validation", "Indique o nome completo.", { issues: [{ field: "name", message: "Indique o nome completo." }] });
    }
    if (!isValidEmail(email)) {
      throw apiError("validation", "Indique um e-mail válido.", { issues: [{ field: "email", message: "Indique um e-mail válido." }] });
    }
    if (!isAdminRole(role)) {
      throw apiError("validation", "Indique um papel válido.", { issues: [{ field: "role", message: "Indique um papel válido." }] });
    }

    const [existing] = await db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.email, email), eq(schema.accounts.kind, "admin")))
      .limit(1);
    if (existing) {
      throw apiError("validation", "Já existe um utilizador com este e-mail.", {
        issues: [{ field: "email", message: "Já existe um utilizador com este e-mail." }],
      });
    }

    const [account] = await db
      .insert(schema.accounts)
      .values({ id: newId("acc"), kind: "admin", email, fullName: name, active: true, adminRole: role, passwordHash: null })
      .returning();
    if (!account) throw apiError("server", "Não foi possível criar o utilizador.");

    await recordAdminAudit({
      actorAccountId: request.adminAccount!.id,
      action: "admin_user.create",
      targetModule: "admin_user",
      targetId: account.id,
      targetLabel: account.fullName,
      reason,
      changes: [{ field: "Papel", from: "—", to: ROLE_LABELS[role] }],
    });

    return dataEnvelope(toWireAdminUser(account));
  });

  app.patch("/admin/users/:id/role", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    requireAdminRole(request.adminAccount!.adminRole as AdminRole);

    const { id } = request.params as { id: string };
    const body = changeRoleBody.parse(request.body);
    const reason = requireReason(body.reason);
    const role = body.role;

    if (!isAdminRole(role)) {
      throw apiError("validation", "Indique um papel válido.", { issues: [{ field: "role", message: "Indique um papel válido." }] });
    }

    const [user] = await db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, id), eq(schema.accounts.kind, "admin")))
      .limit(1);
    if (!user) throw apiError("not_found", "Utilizador não encontrado.");
    if (user.id === request.adminAccount!.id) {
      throw apiError("validation", "Não pode alterar o seu próprio papel.");
    }
    if (user.adminRole === role) {
      throw apiError("validation", "O utilizador já tem este papel.");
    }

    const [updated] = await db
      .update(schema.accounts)
      .set({ adminRole: role, updatedAt: new Date() })
      .where(eq(schema.accounts.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível actualizar o utilizador.");

    await recordAdminAudit({
      actorAccountId: request.adminAccount!.id,
      action: "admin_user.role",
      targetModule: "admin_user",
      targetId: user.id,
      targetLabel: user.fullName,
      reason,
      changes: [{ field: "Papel", from: ROLE_LABELS[user.adminRole as AdminRole], to: ROLE_LABELS[role] }],
    });

    return dataEnvelope(toWireAdminUser(updated));
  });

  app.patch("/admin/users/:id/active", { preHandler: [authenticateAdmin, requireCsrf] }, async (request) => {
    requireAdminRole(request.adminAccount!.adminRole as AdminRole);

    const { id } = request.params as { id: string };
    const body = setActiveBody.parse(request.body);
    const reason = requireReason(body.reason);

    const [user] = await db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, id), eq(schema.accounts.kind, "admin")))
      .limit(1);
    if (!user) throw apiError("not_found", "Utilizador não encontrado.");
    if (user.id === request.adminAccount!.id) {
      throw apiError("validation", "Não pode desactivar a sua própria conta.");
    }
    if (user.active === body.active) {
      throw apiError("validation", body.active ? "O utilizador já está activo." : "O utilizador já está desactivado.");
    }

    const [updated] = await db
      .update(schema.accounts)
      .set({ active: body.active, updatedAt: new Date() })
      .where(eq(schema.accounts.id, id))
      .returning();
    if (!updated) throw apiError("server", "Não foi possível actualizar o utilizador.");

    await recordAdminAudit({
      actorAccountId: request.adminAccount!.id,
      action: body.active ? "admin_user.activate" : "admin_user.deactivate",
      targetModule: "admin_user",
      targetId: user.id,
      targetLabel: user.fullName,
      reason,
      changes: [{ field: "Estado", from: body.active ? "Desactivado" : "Activo", to: body.active ? "Activo" : "Desactivado" }],
    });

    return dataEnvelope(toWireAdminUser(updated));
  });
}
