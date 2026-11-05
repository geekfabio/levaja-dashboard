import type { FastifyBaseLogger } from "fastify";

export type SendMailInput = {
  to: string;
  subject: string;
  body: string;
};

export async function sendMail(input: SendMailInput, logger?: FastifyBaseLogger) {
  const live = process.env.EMAIL_LIVE === "true";
  if (!live) {
    const log = logger?.info.bind(logger) ?? console.log;
    log({ mail: input }, "Email simulado (EMAIL_LIVE!=true)");
    return;
  }

  // Fase 9 liga um fornecedor real (ex.: Resend) aqui. Por agora o envio real
  // não está implementado, mesmo com EMAIL_LIVE=true.
  const log = logger?.warn.bind(logger) ?? console.warn;
  log({ mail: input }, "EMAIL_LIVE=true mas nenhum fornecedor de email está ligado ainda (Fase 9)");
}
