import type { FastifyReply, FastifyRequest } from "fastify";
import { apiError } from "./envelope";
import { computeCsrfToken, csrfTokensMatch } from "./csrf";

export async function requireCsrf(request: FastifyRequest, _reply: FastifyReply) {
  const session = request.adminSession;
  if (!session) {
    throw apiError("unauthorized", "Sessão inválida ou expirada. Inicie sessão novamente.");
  }

  const header = request.headers["x-csrf-token"];
  const provided = Array.isArray(header) ? header[0] : header;
  const expected = computeCsrfToken(session.csrfSecret);

  if (!csrfTokensMatch(expected, provided)) {
    throw apiError("forbidden", "Token CSRF inválido ou ausente.");
  }
}
