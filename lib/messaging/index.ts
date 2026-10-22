import { sandboxAdapter } from "./sandbox";
import type { MessageChannel, MessagingAdapter } from "./types";

export const PROVIDERS: Record<MessageChannel, { name: string; status: string }> = {
  SMS: { name: "Umoja Global (MIMOSMS)", status: "Por ligar — credenciais em Supabase secrets" },
  "E-mail": { name: "Fornecedor de e-mail", status: "Por escolher (ROADMAP, Fase 4)" },
  WhatsApp: { name: "WhatsApp Business API", status: "Por contratar — exige número verificado e modelos aprovados" },
};

export function isMessagingLive() {
  return typeof window === "undefined" && process.env.MESSAGING_LIVE === "true";
}

export function messagingAdapter(): MessagingAdapter {
  return sandboxAdapter;
}

export type { MessageChannel, MessagingAdapter, OutgoingMessage, SendResult } from "./types";
