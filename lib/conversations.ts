import { OPT_OUT_KEYWORDS, WHATSAPP_WINDOW_HOURS, type Conversation } from "@/data/conversations";

export function lastInbound(conversation: Conversation) {
  return [...conversation.messages].reverse().find((message) => message.direction === "in");
}

export function lastMessage(conversation: Conversation) {
  return conversation.messages[conversation.messages.length - 1];
}

export function withinWhatsAppWindow(conversation: Conversation, nowMs: number) {
  if (conversation.channel !== "WhatsApp") return true;
  const inbound = lastInbound(conversation);
  if (!inbound) return false;
  return nowMs - Date.parse(`${inbound.at}:00+01:00`) < WHATSAPP_WINDOW_HOURS * 60 * 60 * 1000;
}

export function isOptOut(body: string) {
  const normalized = body
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return OPT_OUT_KEYWORDS.includes(normalized);
}
