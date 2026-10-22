import { SANDBOX_ADDRESS, SANDBOX_PHONE } from "@/data/campaigns";
import type { MessagingAdapter } from "./types";

export const sandboxAdapter: MessagingAdapter = {
  name: "Sandbox",
  live: false,
  send: (message) => ({
    ok: true,
    deliveredTo: message.channel === "E-mail" ? SANDBOX_ADDRESS : SANDBOX_PHONE,
    providerId: `sandbox-${crypto.randomUUID().slice(0, 8)}`,
  }),
};
