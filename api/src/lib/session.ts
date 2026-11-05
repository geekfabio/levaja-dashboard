import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { refreshTokens } from "../db/schema/auth";
import { loadEnv } from "../env";
import type { AccountRow } from "./account";
import { toClientResponse } from "./account";
import type { AccountKind } from "./jwt";
import { signAccessToken } from "./jwt";
import { newId } from "./ids";
import { hashOpaqueToken, newOpaqueToken } from "./tokens";

const env = loadEnv();

export type SessionResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  user: Awaited<ReturnType<typeof toClientResponse>>;
  provider_id: string | null;
};

export type IssuedSession = {
  session: SessionResponse;
  refreshTokenId: string;
};

export async function issueSession(account: AccountRow): Promise<IssuedSession> {
  const kind = account.kind as AccountKind;
  const { token: accessToken, expiresIn } = await signAccessToken({
    sub: account.id,
    kind,
    email: account.email,
  });

  const refreshToken = newOpaqueToken("rt");
  const refreshTokenId = newId("rtk");
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    id: refreshTokenId,
    accountId: account.id,
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt,
  });

  const user = await toClientResponse(account);

  return {
    refreshTokenId,
    session: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      user,
      provider_id: kind === "provider" ? account.id : null,
    },
  };
}

export async function revokeRefreshToken(refreshTokenId: string, replacedByTokenId?: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedByTokenId: replacedByTokenId ?? null })
    .where(eq(refreshTokens.id, refreshTokenId));
}
