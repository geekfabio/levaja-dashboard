import { db, schema } from "../db/client";
import { newId } from "./ids";

export type AdminAccessResult = "success" | "wrong_code" | "two_factor_failed" | "inactive" | "logout" | "revoked";

export async function recordAdminAccess(options: {
  accountId?: string | null;
  email: string;
  userName?: string | null;
  result: AdminAccessResult;
  ip?: string | null;
  device?: string | null;
}) {
  await db.insert(schema.adminAccessLog).values({
    id: newId("acc"),
    accountId: options.accountId ?? undefined,
    email: options.email,
    userName: options.userName ?? undefined,
    result: options.result,
    ip: options.ip ?? undefined,
    device: options.device ?? undefined,
  });
}
