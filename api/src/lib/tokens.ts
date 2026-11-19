import { createHash, randomBytes, randomInt } from "node:crypto";

export function newOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Temporary stand-in while no e-mail provider is connected: with OTP_FIXED_CODE
 * set, every new code is that value. Validated at startup (src/env.ts); unset
 * means random codes, which is the only behaviour outside that environment.
 */
export function newOtpCode() {
  const fixed = process.env.OTP_FIXED_CODE;
  if (fixed && /^\d{6}$/.test(fixed)) return fixed;
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
