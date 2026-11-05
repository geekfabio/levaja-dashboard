import * as argon2 from "argon2";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { otpCodes } from "../db/schema/auth";
import { apiError } from "./envelope";
import { newId } from "./ids";
import { newOtpCode } from "./tokens";

export type OtpPurpose = "register" | "recover";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function createOtp(params: { email: string; purpose: OtpPurpose; accountId?: string }) {
  const code = newOtpCode();
  const codeHash = await argon2.hash(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(otpCodes).values({
    id: newId("otp"),
    accountId: params.accountId ?? null,
    email: params.email.toLowerCase(),
    purpose: params.purpose,
    codeHash,
    expiresAt,
  });

  return code;
}

export async function findLatestOtp(email: string) {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.email, email.toLowerCase()))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  return row;
}

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string) {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email.toLowerCase()), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) {
    throw apiError("validation", "Código incorrecto ou expirado.");
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
    throw apiError("validation", "O código expirou. Pede um código novo.");
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
    throw apiError("validation", "Demasiadas tentativas erradas. Pede um código novo.");
  }

  const valid = await argon2.verify(row.codeHash, code);
  if (!valid) {
    const attempts = row.attempts + 1;
    await db
      .update(otpCodes)
      .set({ attempts, consumedAt: attempts >= MAX_ATTEMPTS ? new Date() : null })
      .where(eq(otpCodes.id, row.id));
    throw apiError("validation", "Código incorrecto.");
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
  return row;
}
