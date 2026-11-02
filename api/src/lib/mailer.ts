export type MailMessage = {
  to: string;
  subject: string;
  body: string;
};

export type MailResult = {
  sent: boolean;
  simulated: boolean;
};

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const live = process.env.EMAIL_LIVE === "true";

  if (!live) {
    console.log(`[mailer] (simulado) para=${message.to} assunto="${message.subject}"\n${message.body}`);
    return { sent: true, simulated: true };
  }

  console.log(`[mailer] EMAIL_LIVE=true mas o envio real ainda não está implementado. para=${message.to} assunto="${message.subject}"`);
  return { sent: true, simulated: true };
}
