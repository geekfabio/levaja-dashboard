import { createHash } from "node:crypto";
import { newOtpCode } from "./tokens";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode() {
  return newOtpCode();
}

export function hashOtpCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}
