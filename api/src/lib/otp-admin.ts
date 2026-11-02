import { createHash, randomInt } from "node:crypto";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}
