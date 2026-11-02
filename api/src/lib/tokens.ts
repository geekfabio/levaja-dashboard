import { createHash, randomBytes } from "node:crypto";

export function newOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newOtpCode() {
  const value = Math.floor(Math.random() * 1_000_000);
  return value.toString().padStart(6, "0");
}
