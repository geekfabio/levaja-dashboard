import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { providerDocuments } from "../db/schema/ops";

export const REQUIRED_DOCUMENT_KINDS = ["license", "id", "vehicle", "insurance"] as const;

export async function documentsVerified(providerAccountId: string) {
  const rows = await db.select().from(providerDocuments).where(eq(providerDocuments.providerAccountId, providerAccountId));
  const now = new Date();
  return REQUIRED_DOCUMENT_KINDS.every((kind) =>
    rows.some((row) => row.kind === kind && row.status === "verified" && (!row.validUntil || row.validUntil >= now)),
  );
}
