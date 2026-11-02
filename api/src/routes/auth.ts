import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { accounts, refreshTokens } from "../db/schema/auth";
import { clients } from "../db/schema/ops";
import { findAccountByEmailAndKind, findAccountById, toClientResponse } from "../lib/account";
import { authenticate } from "../lib/authenticate";
import { apiError, dataEnvelope } from "../lib/envelope";
import { newId } from "../lib/ids";
import { sendMail } from "../lib/mailer";
import { createOtp, findLatestOtp, verifyOtp } from "../lib/otp";
import { formatAngolaPhone } from "../lib/phone";
import { issueSession } from "../lib/session";
import { hashOpaqueToken } from "../lib/tokens";
import * as argon2 from "argon2";

const emailSchema = z.string().trim().min(1).email();
const passwordSchema = z.string().min(8, "A palavra-passe tem de ter pelo menos 8 caracteres.").regex(/\d/, "A palavra-passe tem de incluir pelo menos um número.");

const registerSchema = z.object({
  full_name: z.string().trim().min(3, "Indica o nome completo."),
  email: emailSchema,
  phone: z.string().trim().min(1),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  role: z.enum(["client", "provider"]),
});

const recoverSchema = z.object({ email: emailSchema });

const verifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Introduz os 6 dígitos."),
  purpose: z.enum(["register", "recover"]),
});

const resendSchema = z.object({ email: emailSchema });

const refreshSchema = z.object({ refresh_token: z.string().min(1) });

const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});

const patchClientSchema = z.object({
  full_name: z.string().trim().min(3).optional(),
  email: emailSchema.optional(),
  phone: z.string().trim().min(1).optional(),
});

const registerOtpMail = (code: string) => ({
  subject: "O teu código AngoLeva",
  body: `O teu código de confirmação é ${code}. Expira em 10 minutos.`,
});

const recoverOtpMail = (code: string) => ({
  subject: "Recuperar a palavra-passe AngoLeva",
  body: `O teu código para recuperar a conta é ${code}. Expira em 10 minutos.`,
});

export async function authRoutes(app: FastifyInstance) {
  app.decorateRequest("account", undefined);

  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const email = body.email.toLowerCase();
    const phone = formatAngolaPhone(body.phone);

    const existing = await findAccountByEmailAndKind(email, "client");
    if (existing) {
      throw apiError("validation", "Já existe uma conta com este email.");
    }

    const passwordHash = await argon2.hash(body.password);
    const accountId = newId("acc");

    await db.insert(accounts).values({
      id: accountId,
      kind: "client",
      email,
      phone,
      passwordHash,
      fullName: body.full_name,
      active: false,
    });
    await db.insert(clients).values({ accountId });

    const code = await createOtp({ email, purpose: "register", accountId });
    const mail = registerOtpMail(code);
    await sendMail({ to: email, ...mail }, request.log);

    reply.status(204).send();
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const account = await findAccountByEmailAndKind(email, body.role);
    const passwordHash = account?.passwordHash;
    const valid = account?.active && passwordHash ? await argon2.verify(passwordHash, body.password) : false;

    if (!account || !account.active || !valid) {
      throw apiError("unauthorized", "Email ou palavra-passe incorrectos.");
    }

    const { session } = await issueSession(account);
    reply.send(dataEnvelope(session));
  });

  app.post("/auth/recover", async (request, reply) => {
    const body = recoverSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const account = await findAccountByEmailAndKind(email, "client");
    if (account) {
      const code = await createOtp({ email, purpose: "recover", accountId: account.id });
      const mail = recoverOtpMail(code);
      await sendMail({ to: email, ...mail }, request.log);
    }

    reply.status(204).send();
  });

  app.post("/auth/verify", async (request, reply) => {
    const body = verifySchema.parse(request.body);
    const email = body.email.toLowerCase();

    await verifyOtp(email, body.purpose, body.code);

    const account = await findAccountByEmailAndKind(email, "client");
    if (!account) {
      throw apiError("validation", "Conta não encontrada.");
    }

    if (body.purpose === "register" && !account.active) {
      await db.update(accounts).set({ active: true, updatedAt: new Date() }).where(eq(accounts.id, account.id));
      account.active = true;
    }

    const { session } = await issueSession(account);
    reply.send(dataEnvelope(session));
  });

  app.post("/auth/resend", async (request, reply) => {
    const body = resendSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const latest = await findLatestOtp(email);
    if (latest) {
      const code = await createOtp({ email, purpose: latest.purpose as "register" | "recover", accountId: latest.accountId ?? undefined });
      const mail = latest.purpose === "register" ? registerOtpMail(code) : recoverOtpMail(code);
      await sendMail({ to: email, ...mail }, request.log);
    }

    reply.status(204).send();
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokenHash = hashOpaqueToken(body.refresh_token);

    const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
      throw apiError("unauthorized", "A sessão terminou. Entra de novo.");
    }

    const account = await findAccountById(row.accountId);
    if (!account || !account.active) {
      throw apiError("unauthorized", "A sessão terminou. Entra de novo.");
    }

    const { session, refreshTokenId } = await issueSession(account);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenId: refreshTokenId })
      .where(eq(refreshTokens.id, row.id));

    reply.send(dataEnvelope(session));
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const account = await findAccountById(request.account!.id);
    if (!account) {
      throw apiError("unauthorized", "A conta não existe.");
    }

    const user = await toClientResponse(account);
    reply.send(dataEnvelope({ user, provider_id: account.kind === "provider" ? account.id : null }));
  });

  app.post("/auth/password", { preHandler: authenticate }, async (request, reply) => {
    const body = passwordChangeSchema.parse(request.body);
    const account = await findAccountById(request.account!.id);
    const valid = account?.passwordHash ? await argon2.verify(account.passwordHash, body.current_password) : false;

    if (!account || !valid) {
      throw apiError("unauthorized", "Palavra-passe actual incorrecta.");
    }

    const newHash = await argon2.hash(body.new_password);
    await db.update(accounts).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(accounts.id, account.id));

    reply.status(204).send();
  });

  app.post("/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.accountId, request.account!.id), isNull(refreshTokens.revokedAt)));

    reply.status(204).send();
  });

  app.patch("/clients/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.account!.id !== id) {
      throw apiError("forbidden", "Não tens permissão para alterar este cliente.");
    }

    const body = patchClientSchema.parse(request.body);
    const patch: Partial<typeof accounts.$inferInsert> = { updatedAt: new Date() };
    if (body.full_name !== undefined) patch.fullName = body.full_name;
    if (body.email !== undefined) patch.email = body.email.toLowerCase();
    if (body.phone !== undefined) patch.phone = formatAngolaPhone(body.phone);

    await db.update(accounts).set(patch).where(eq(accounts.id, id));

    const account = await findAccountById(id);
    if (!account) {
      throw apiError("not_found", "Cliente não encontrado.");
    }

    reply.send(dataEnvelope(await toClientResponse(account)));
  });
}
