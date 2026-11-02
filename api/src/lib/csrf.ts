import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { loadEnv } from "../env";

export function newCsrfSecret() {
  return randomBytes(32).toString("hex");
}

export function computeCsrfToken(csrfSecret: string) {
  const env = loadEnv();
  return createHmac("sha256", env.ADMIN_SESSION_SECRET).update(csrfSecret).digest("hex");
}

export function csrfTokensMatch(expected: string, provided: string | undefined) {
  if (!provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
