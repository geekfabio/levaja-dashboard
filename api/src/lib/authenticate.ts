import type { FastifyReply, FastifyRequest } from "fastify";
import { findAccountById } from "./account";
import { apiError } from "./envelope";
import type { AccessTokenPayload } from "./jwt";
import { TokenExpiredError, verifyAccessToken } from "./jwt";

declare module "fastify" {
  interface FastifyRequest {
    account?: AuthenticatedAccount;
  }
}

export type AuthenticatedAccount = {
  id: string;
  kind: AccessTokenPayload["kind"];
  email: string;
  fullName: string;
  phone: string | null;
  active: boolean;
};

function extractBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw apiError("unauthorized", "Autenticação necessária.");
  }
  return header.slice("Bearer ".length).trim();
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const token = extractBearerToken(request);

  let payload: AccessTokenPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw apiError("token_expired", "O token de acesso expirou.");
    }
    throw apiError("unauthorized", "Token inválido.");
  }

  const account = await findAccountById(payload.sub);
  if (!account || !account.active) {
    throw apiError("unauthorized", "A conta não existe ou está inactiva.");
  }

  request.account = {
    id: account.id,
    kind: account.kind as AccessTokenPayload["kind"],
    email: account.email,
    fullName: account.fullName,
    phone: account.phone,
    active: account.active,
  };
}
