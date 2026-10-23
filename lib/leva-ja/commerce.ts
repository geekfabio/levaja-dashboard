import type {
  BroadcastChannel,
  BroadcastSegment,
  BroadcastStatus,
  Promotion,
  PromotionKind,
  PromotionStatus,
  ServiceKind,
} from "@/types/leva-ja";

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  scheduled: "Agendada",
  active: "Activa",
  paused: "Em pausa",
  ended: "Terminada",
  exhausted: "Orçamento esgotado",
};

export const PROMOTION_STATUS_TONES = { scheduled: "info", active: "success", paused: "warning", ended: "neutral", exhausted: "danger" } as const;

export const PROMOTION_KIND_LABELS: Record<PromotionKind, string> = { percent: "Percentagem", fixed: "Valor fixo" };

export const BROADCAST_CHANNEL_LABELS: Record<BroadcastChannel, string> = { push: "Notificação na app", sms: "SMS", email: "E-mail" };

export const BROADCAST_SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  all: "Todos",
  inactive_30: "Sem pedidos há 30 dias",
  new_30: "Registados nos últimos 30 dias",
  online: "Online agora",
  business: "Utilizadores de contas empresariais",
};

export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sent: "Envio simulado",
  cancelled: "Cancelada",
};

export const BROADCAST_STATUS_TONES = { draft: "neutral", scheduled: "info", sent: "success", cancelled: "danger" } as const;

export const PAYMENT_TERMS = [15, 30, 45, 60] as const;

export function monthOf(iso: string) {
  const date = new Date(new Date(iso).getTime() + 3_600_000);
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  const [year, value] = month.split("-");
  const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${names[Number(value) - 1] ?? value} de ${year}`;
}

export function statementDueDate(month: string, termsDays: number) {
  const [year, value] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, value, 0, 12));
  lastDay.setUTCDate(lastDay.getUTCDate() + termsDays);
  return lastDay.toISOString().slice(0, 10);
}

export function businessAmounts(totals: number[], discountRate: number) {
  const gross = totals.reduce((sum, value) => sum + value, 0);
  const discount = Math.round(gross * discountRate);
  return { gross, discount, net: gross - discount, count: totals.length };
}

export function contractIssues(contract: { startsAt: string; endsAt: string; discountRate: number; paymentTermsDays: number; creditLimit: number }) {
  const issues: { field: string; message: string }[] = [];
  if (Number.isNaN(Date.parse(contract.startsAt)) || Number.isNaN(Date.parse(contract.endsAt)) || contract.endsAt <= contract.startsAt) {
    issues.push({ field: "endsAt", message: "O fim do contrato tem de ser depois do início." });
  }
  if (!Number.isFinite(contract.discountRate) || contract.discountRate < 0 || contract.discountRate > 0.3) issues.push({ field: "discountRate", message: "O desconto tem de estar entre 0 % e 30 %." });
  if (!(PAYMENT_TERMS as readonly number[]).includes(contract.paymentTermsDays)) issues.push({ field: "paymentTermsDays", message: "Escolha um prazo de pagamento de 15, 30, 45 ou 60 dias." });
  if (!Number.isInteger(contract.creditLimit) || contract.creditLimit < 0) issues.push({ field: "creditLimit", message: "O limite de crédito não pode ser negativo." });
  return issues;
}

export function promotionStatus(promotion: Pick<Promotion, "startsAt" | "endsAt" | "paused" | "endedAt" | "budget" | "uses">, now: number): PromotionStatus {
  if (promotion.endedAt || Date.parse(promotion.endsAt) <= now) return "ended";
  if (promotion.uses.reduce((sum, use) => sum + use.discount, 0) >= promotion.budget) return "exhausted";
  if (promotion.paused) return "paused";
  if (Date.parse(promotion.startsAt) > now) return "scheduled";
  return "active";
}

export type PromotionInput = Pick<
  Promotion,
  "code" | "name" | "kind" | "value" | "maxDiscount" | "minOrder" | "services" | "zoneIds" | "startsAt" | "endsAt" | "budget" | "perClientLimit" | "firstOrderOnly"
>;

export function promotionIssues(input: PromotionInput, existingCodes: string[]) {
  const issues: { field: string; message: string }[] = [];
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) issues.push({ field: "code", message: "O código tem 4 a 12 letras ou números, sem espaços." });
  else if (existingCodes.includes(code)) issues.push({ field: "code", message: "Já existe uma promoção com este código." });
  if (input.name.trim().length < 3) issues.push({ field: "name", message: "Indique o nome da promoção." });
  if (input.kind === "percent" && (!Number.isInteger(input.value) || input.value < 1 || input.value > 50)) issues.push({ field: "value", message: "A percentagem tem de estar entre 1 % e 50 %." });
  if (input.kind === "fixed" && (!Number.isInteger(input.value) || input.value < 100)) issues.push({ field: "value", message: "O desconto fixo tem de ser de pelo menos 100 Kz." });
  if (!Number.isInteger(input.minOrder) || input.minOrder < 0) issues.push({ field: "minOrder", message: "O valor mínimo não pode ser negativo." });
  if (Number.isNaN(Date.parse(input.startsAt)) || Number.isNaN(Date.parse(input.endsAt)) || input.endsAt <= input.startsAt) issues.push({ field: "endsAt", message: "O fim tem de ser depois do início." });
  if (!Number.isInteger(input.budget) || input.budget < 1000) issues.push({ field: "budget", message: "O orçamento tem de ser de pelo menos 1 000 Kz." });
  if (!Number.isInteger(input.perClientLimit) || input.perClientLimit < 1) issues.push({ field: "perClientLimit", message: "Cada cliente tem de poder usar pelo menos uma vez." });
  return issues;
}

export type PromotionOrder = { total: number; kind: ServiceKind; zoneId: string; clientOrders: number; clientUses: number };

export function promotionDiscount(promotion: Promotion, order: PromotionOrder, now: number): { discount: number; reason?: string } {
  const status = promotionStatus(promotion, now);
  if (status !== "active") return { discount: 0, reason: `A promoção está «${PROMOTION_STATUS_LABELS[status].toLowerCase()}».` };
  if (promotion.services.length && !promotion.services.includes(order.kind)) return { discount: 0, reason: "Serviço não abrangido." };
  if (promotion.zoneIds.length && !promotion.zoneIds.includes(order.zoneId)) return { discount: 0, reason: "Zona não abrangida." };
  if (order.total < promotion.minOrder) return { discount: 0, reason: "Abaixo do valor mínimo." };
  if (promotion.firstOrderOnly && order.clientOrders > 0) return { discount: 0, reason: "Só para o primeiro pedido." };
  if (order.clientUses >= promotion.perClientLimit) return { discount: 0, reason: "Limite de utilizações do cliente atingido." };
  const raw = promotion.kind === "percent" ? Math.round((order.total * promotion.value) / 100) : promotion.value;
  const capped = Math.min(raw, promotion.maxDiscount ?? raw, order.total);
  const left = promotion.budget - promotion.uses.reduce((sum, use) => sum + use.discount, 0);
  return { discount: Math.max(0, Math.min(capped, left)) };
}

export function smsParts(text: string) {
  const length = [...text].length;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}

export function renderBroadcast(message: string, name: string) {
  return message.replace(/\{nome\}/g, name.split(" ")[0] ?? name);
}

export function broadcastIssues(input: { title: string; channel: BroadcastChannel; subject?: string; message: string }) {
  const issues: { field: string; message: string }[] = [];
  if (input.title.trim().length < 3) issues.push({ field: "title", message: "Indique um título interno." });
  if (input.message.trim().length < 10) issues.push({ field: "message", message: "A mensagem tem de ter pelo menos 10 caracteres." });
  if (input.channel === "sms" && smsParts(input.message) > 3) issues.push({ field: "message", message: "Um SMS não pode passar 3 partes (459 caracteres)." });
  if (input.channel === "push" && [...input.message].length > 240) issues.push({ field: "message", message: "Uma notificação não pode passar 240 caracteres." });
  if (input.channel === "email" && (input.subject ?? "").trim().length < 3) issues.push({ field: "subject", message: "Indique o assunto do e-mail." });
  return issues;
}
