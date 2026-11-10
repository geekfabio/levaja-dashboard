import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import "dotenv/config";
import * as argon2 from "argon2";
import { and, eq, isNull } from "drizzle-orm";
import { SignJWT } from "jose";
import { buildApp } from "../src/app";
import { db } from "../src/db/client";
import { accounts, otpCodes, refreshTokens } from "../src/db/schema/auth";
import { clients } from "../src/db/schema/ops";

function testEmail(tag: string) {
  return `teste-movel-${tag}-${randomUUID()}@angoleva.ao`;
}

async function cleanupAccount(email: string) {
  const normalized = email.toLowerCase();
  const rows = await db.select().from(accounts).where(eq(accounts.email, normalized));
  for (const row of rows) {
    await db.delete(refreshTokens).where(eq(refreshTokens.accountId, row.id));
    await db.delete(clients).where(eq(clients.accountId, row.id));
  }
  await db.delete(otpCodes).where(eq(otpCodes.email, normalized));
  await db.delete(accounts).where(eq(accounts.email, normalized));
}

async function forceOtpCode(email: string, purpose: "register" | "recover", code: string) {
  const normalized = email.toLowerCase();
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, normalized), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)))
    .limit(1);
  assert.ok(row, `esperava um código ${purpose} pendente para ${normalized}`);
  await db
    .update(otpCodes)
    .set({ codeHash: await argon2.hash(code), attempts: 0 })
    .where(eq(otpCodes.id, row.id));
}

async function craftAccessToken(payload: { sub: string; kind: string; email: string }, expiredSecondsAgo: number) {
  const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - expiredSecondsAgo - 10)
    .setExpirationTime(now - expiredSecondsAgo)
    .sign(secret);
}

test("registo completo até à sessão (código certo cria a sessão)", async () => {
  const app = await buildApp();
  const email = testEmail("registo");
  try {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Teste", email, phone: "923456789", password: "senha1234" },
    });
    assert.equal(register.statusCode, 204);

    await forceOtpCode(email, "register", "654321");

    const verify = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "654321", purpose: "register" },
    });
    assert.equal(verify.statusCode, 200);
    const body = verify.json();
    assert.equal(body.data.token_type, "Bearer");
    assert.ok(body.data.access_token);
    assert.ok(body.data.refresh_token);
    assert.equal(body.data.user.email, email.toLowerCase());
    assert.equal(body.data.user.full_name, "Cliente Teste");
    assert.equal(body.data.user.phone, "+244 923 456 789");
    assert.equal(body.data.provider_id, null);

    const [account] = await db.select().from(accounts).where(eq(accounts.email, email.toLowerCase()));
    assert.equal(account?.active, true);
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});

test("código errado é rejeitado (validation) e não cria sessão", async () => {
  const app = await buildApp();
  const email = testEmail("codigo-errado");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Errado", email, phone: "924000111", password: "senha1234" },
    });
    await forceOtpCode(email, "register", "111222");

    const wrong = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "000000", purpose: "register" },
    });
    assert.equal(wrong.statusCode, 422);
    assert.equal(wrong.json().error.code, "validation");

    const right = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "111222", purpose: "register" },
    });
    assert.equal(right.statusCode, 200);
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});

test("login certo e errado", async () => {
  const app = await buildApp();
  const email = testEmail("login");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Login", email, phone: "925111222", password: "senha1234" },
    });
    await forceOtpCode(email, "register", "333444");
    await app.inject({ method: "POST", url: "/auth/verify", payload: { email, code: "333444", purpose: "register" } });

    const okLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "senha1234", role: "client" },
    });
    assert.equal(okLogin.statusCode, 200);
    assert.equal(okLogin.json().data.user.email, email.toLowerCase());

    const badPassword = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "errada123", role: "client" },
    });
    assert.equal(badPassword.statusCode, 401);
    assert.equal(badPassword.json().error.code, "unauthorized");

    const unknownEmail = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: testEmail("inexistente"), password: "qualquer123", role: "client" },
    });
    assert.equal(unknownEmail.statusCode, 401);
    assert.equal(unknownEmail.json().error.code, "unauthorized");
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});

test("renovação com rotação: o refresh token antigo deixa de servir", async () => {
  const app = await buildApp();
  const email = testEmail("refresh");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Refresh", email, phone: "926111222", password: "senha1234" },
    });
    await forceOtpCode(email, "register", "555666");
    const verify = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "555666", purpose: "register" },
    });
    const firstRefreshToken = verify.json().data.refresh_token;

    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: firstRefreshToken },
    });
    assert.equal(refreshed.statusCode, 200);
    const secondRefreshToken = refreshed.json().data.refresh_token;
    assert.notEqual(secondRefreshToken, firstRefreshToken);

    const reuseOld = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: firstRefreshToken },
    });
    assert.equal(reuseOld.statusCode, 401);
    assert.equal(reuseOld.json().error.code, "unauthorized");

    const useNew = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: secondRefreshToken },
    });
    assert.equal(useNew.statusCode, 200);
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});

test("GET /auth/me com e sem token", async () => {
  const app = await buildApp();
  const email = testEmail("me");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Me", email, phone: "927111222", password: "senha1234" },
    });
    await forceOtpCode(email, "register", "777888");
    const verify = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "777888", purpose: "register" },
    });
    const accessToken = verify.json().data.access_token;

    const withToken = await app.inject({ method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${accessToken}` } });
    assert.equal(withToken.statusCode, 200);
    assert.equal(withToken.json().data.user.email, email.toLowerCase());
    assert.equal(withToken.json().data.provider_id, null);

    const withoutToken = await app.inject({ method: "GET", url: "/auth/me" });
    assert.equal(withoutToken.statusCode, 401);
    assert.equal(withoutToken.json().error.code, "unauthorized");
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});

test("token_expired vs unauthorized", async () => {
  const app = await buildApp();
  const email = testEmail("expirado");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Expirado", email, phone: "928111222", password: "senha1234" },
    });
    await forceOtpCode(email, "register", "999000");
    const verify = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "999000", purpose: "register" },
    });
    const accountId = verify.json().data.user.id;

    const expiredToken = await craftAccessToken({ sub: accountId, kind: "client", email: email.toLowerCase() }, 60);
    const expiredResponse = await app.inject({ method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${expiredToken}` } });
    assert.equal(expiredResponse.statusCode, 401);
    assert.equal(expiredResponse.json().error.code, "token_expired");

    const garbageResponse = await app.inject({ method: "GET", url: "/auth/me", headers: { authorization: "Bearer not-a-real-token" } });
    assert.equal(garbageResponse.statusCode, 401);
    assert.equal(garbageResponse.json().error.code, "unauthorized");
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});

test("PATCH /clients/:id recusa alterar outro utilizador", async () => {
  const app = await buildApp();
  const emailA = testEmail("dono-a");
  const emailB = testEmail("dono-b");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente A", email: emailA, phone: "929111222", password: "senha1234" },
    });
    await forceOtpCode(emailA, "register", "121212");
    const verifyA = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email: emailA, code: "121212", purpose: "register" },
    });
    const tokenA = verifyA.json().data.access_token;

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente B", email: emailB, phone: "929333444", password: "senha1234" },
    });
    await forceOtpCode(emailB, "register", "343434");
    const verifyB = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email: emailB, code: "343434", purpose: "register" },
    });
    const idB = verifyB.json().data.user.id;

    const forbidden = await app.inject({
      method: "PATCH",
      url: `/clients/${idB}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { full_name: "Tentativa Alheia" },
    });
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().error.code, "forbidden");

    const idA = verifyA.json().data.user.id;
    const allowed = await app.inject({
      method: "PATCH",
      url: `/clients/${idA}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { full_name: "Cliente A Actualizado" },
    });
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.json().data.full_name, "Cliente A Actualizado");
  } finally {
    await cleanupAccount(emailA);
    await cleanupAccount(emailB);
    await app.close();
  }
});

test("recuperação de palavra-passe por código", async () => {
  const app = await buildApp();
  const email = testEmail("recuperar");
  try {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { full_name: "Cliente Recupera", email, phone: "921111222", password: "senha1234" },
    });
    await forceOtpCode(email, "register", "456789");
    await app.inject({ method: "POST", url: "/auth/verify", payload: { email, code: "456789", purpose: "register" } });

    const recover = await app.inject({ method: "POST", url: "/auth/recover", payload: { email } });
    assert.equal(recover.statusCode, 204);

    await forceOtpCode(email, "recover", "987654");
    const verifyRecover = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { email, code: "987654", purpose: "recover" },
    });
    assert.equal(verifyRecover.statusCode, 200);
    assert.equal(verifyRecover.json().data.user.email, email.toLowerCase());
  } finally {
    await cleanupAccount(email);
    await app.close();
  }
});
