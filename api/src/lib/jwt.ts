import { errors as joseErrors, jwtVerify, SignJWT } from "jose";
import { loadEnv } from "../env";

export type AccountKind = "client" | "provider" | "admin";

export type AccessTokenPayload = {
  sub: string;
  kind: AccountKind;
  email: string;
};

const env = loadEnv();
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export async function signAccessToken(payload: AccessTokenPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_SECONDS}s`)
    .sign(accessSecret);
  return { token, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export class TokenExpiredError extends Error {}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    return payload as unknown as AccessTokenPayload;
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new TokenExpiredError("O token de acesso expirou.");
    }
    throw error;
  }
}
