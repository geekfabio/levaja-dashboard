import { createHash, randomBytes, randomInt } from "node:crypto";

export function newOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
