import type { AccessResult, AdminUser, PrivacyRequest, PrivacyRequestKind, PrivacyRequestStatus, SecuritySettings, Ticket, TicketPriority } from "@/types/leva-ja";

export const PRIVACY_DEADLINE_DAYS = 30;
export const PRIVACY_DUE_SOON_DAYS = 7;

export const PRIVACY_KIND_LABELS: Record<PrivacyRequestKind, string> = {
  access: "Acesso aos dados",
  rectification: "Rectificação",
  erasure: "Eliminação",
  portability: "Portabilidade",
  objection: "Oposição ao tratamento",
};

export const PRIVACY_STATUS_LABELS: Record<PrivacyRequestStatus, string> = {
  received: "Recebido",
  in_progress: "Em tratamento",
  completed: "Concluído",
  rejected: "Recusado",
};

export const PRIVACY_STATUS_TONES = { received: "warning", in_progress: "info", completed: "success", rejected: "neutral" } as const;

export const PRIVACY_CHANNEL_LABELS: Record<PrivacyRequest["channel"], string> = { app: "App", email: "E-mail", phone: "Telefone" };

export const ACCESS_RESULT_LABELS: Record<AccessResult, string> = {
  success: "Entrada",
  wrong_code: "Código errado",
  two_factor_failed: "Segundo factor errado",
  inactive: "Conta desactivada",
  logout: "Saída",
  revoked: "Sessão terminada pela administração",
};

export const ACCESS_RESULT_TONES = { success: "success", wrong_code: "danger", two_factor_failed: "danger", inactive: "warning", logout: "neutral", revoked: "warning" } as const;

export const API_SCOPES: { key: string; label: string }[] = [
  { key: "requests.read", label: "Ler pedidos" },
  { key: "requests.write", label: "Criar e alterar pedidos" },
  { key: "providers.read", label: "Ler prestadores" },
  { key: "finance.read", label: "Ler finanças e facturas" },
  { key: "webhooks.manage", label: "Gerir webhooks" },
];

export const WEBHOOK_EVENTS: { key: string; label: string }[] = [
  { key: "request.created", label: "Pedido criado" },
  { key: "request.assigned", label: "Prestador atribuído" },
  { key: "request.delivered", label: "Serviço entregue" },
  { key: "request.cancelled", label: "Pedido cancelado" },
  { key: "payment.paid", label: "Pagamento recebido" },
  { key: "refund.paid", label: "Reembolso pago" },
];

export function addDaysIso(iso: string, days: number) {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

export function privacyUrgency(request: Pick<PrivacyRequest, "dueAt" | "status">, now: number): "overdue" | "due_soon" | "ok" | "closed" {
  if (request.status === "completed" || request.status === "rejected") return "closed";
  const left = Date.parse(request.dueAt) - now;
  if (left < 0) return "overdue";
  return left < PRIVACY_DUE_SOON_DAYS * 86_400_000 ? "due_soon" : "ok";
}

export type ResponseSla = { dueAt: string; respondedAt?: string; status: "met" | "breached" | "pending" | "at_risk"; minutesLeft: number };

export function ticketResponseSla(ticket: Pick<Ticket, "createdAt" | "priority" | "messages">, hours: Record<TicketPriority, number>, now: number): ResponseSla {
  const budget = hours[ticket.priority] * 3_600_000;
  const due = Date.parse(ticket.createdAt) + budget;
  const responded = ticket.messages.find((message) => message.author === "admin")?.at;
  if (responded) return { dueAt: new Date(due).toISOString(), respondedAt: responded, status: Date.parse(responded) <= due ? "met" : "breached", minutesLeft: 0 };
  const left = due - now;
  return {
    dueAt: new Date(due).toISOString(),
    status: left < 0 ? "breached" : left < budget * 0.25 ? "at_risk" : "pending",
    minutesLeft: Math.round(left / 60_000),
  };
}

export function csatStats(scores: number[]) {
  return {
    responses: scores.length,
    average: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null,
    satisfiedRate: scores.length ? scores.filter((value) => value >= 4).length / scores.length : null,
  };
}

export function isTwoFactorRequired(user: Pick<AdminUser, "twoFactorEnabled" | "role">, security: Pick<SecuritySettings, "require2fa">) {
  return security.require2fa || Boolean(user.twoFactorEnabled);
}

export function webhookUrlIssue(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "Indique um endereço completo, começado por https://.";
  }
  if (parsed.protocol !== "https:") return "O endereço tem de usar https.";
  const host = parsed.hostname;
  if (host === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".local")) {
    return "Use um endereço público; redes internas não são aceites.";
  }
  return null;
}

export function maskSecret(secret: string) {
  return `${secret.slice(0, 8)}${"•".repeat(8)}${secret.slice(-4)}`;
}
