import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { ApiError } from "../lib/envelope";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      reply.status(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
      return;
    }
    if (error instanceof ZodError) {
      reply.status(422).send({
        error: {
          code: "validation",
          message: "Dados inválidos.",
          details: { issues: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) },
        },
      });
      return;
    }
    app.log.error(error);
    reply.status(500).send({ error: { code: "server", message: "Erro interno do servidor." } });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: "not_found", message: "Endpoint inexistente." } });
  });
}
