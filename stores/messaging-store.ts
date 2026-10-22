import { create } from "zustand";
import { CURRENT_USER } from "@/data/companies";
import { INITIAL_SMS_BALANCE, LOW_BALANCE_THRESHOLD, TOP_UPS, type TopUp } from "@/data/sms-credit";
import { formatMoney, nowLuandaLocal } from "@/lib/format";
import { messagingAdapter, type MessageChannel, type OutgoingMessage } from "@/lib/messaging";
import { SMS_PRICE, analyzeSms } from "@/lib/sms";
import { recordEvent } from "./audit-store";
import { useNotificationsStore } from "./notifications-store";

export type OutboxStatus = "Simulado" | "Bloqueado";

export type OutboxRecord = {
  id: string;
  at: string;
  channel: MessageChannel;
  to: string;
  toName?: string;
  deliveredTo?: string;
  subject?: string;
  body: string;
  cost: number;
  status: OutboxStatus;
  reason?: string;
  source: string;
  companyId?: string;
  contactId?: string;
};

type MessagingState = {
  balance: number;
  topUps: TopUp[];
  reservations: Record<string, number>;
  outbox: OutboxRecord[];
  available: () => number;
  send: (message: OutgoingMessage) => OutboxRecord;
  requestTopUp: (amount: number) => void;
  confirmTopUp: (id: string) => void;
  cancelTopUp: (id: string) => void;
  reserve: (campaignId: string, amount: number) => void;
  release: (campaignId: string) => void;
};

export function smsCost(body: string) {
  return analyzeSms(body).messages * SMS_PRICE;
}

function reference() {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  return `MCX ${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  balance: INITIAL_SMS_BALANCE,
  topUps: TOP_UPS,
  reservations: {},
  outbox: [],

  available: () => get().balance - Object.values(get().reservations).reduce((sum, value) => sum + value, 0),

  send: (message) => {
    const at = nowLuandaLocal();
    const id = `msg-${crypto.randomUUID().slice(0, 8)}`;
    const cost = message.channel === "SMS" ? smsCost(message.body) : 0;
    const base = { id, at, ...message, cost };

    if (message.channel === "SMS" && cost > get().available()) {
      const blocked: OutboxRecord = {
        ...base,
        status: "Bloqueado",
        reason: `Saldo de SMS insuficiente (faltam ${formatMoney(cost - get().available())}).`,
      };
      set((state) => ({ outbox: [blocked, ...state.outbox] }));
      return blocked;
    }

    const result = messagingAdapter().send(message);
    const record: OutboxRecord = result.ok
      ? { ...base, status: "Simulado", deliveredTo: result.deliveredTo }
      : { ...base, status: "Bloqueado", reason: result.error ?? "O fornecedor recusou a mensagem." };
    const before = get().balance;
    set((state) => ({
      outbox: [record, ...state.outbox],
      balance: record.status === "Simulado" ? state.balance - cost : state.balance,
    }));
    const after = get().balance;
    if (before >= LOW_BALANCE_THRESHOLD && after < LOW_BALANCE_THRESHOLD) {
      useNotificationsStore.getState().push({
        id: `n-${id}`,
        kind: "alert",
        message: `Saldo de SMS baixo: ${formatMoney(after)} (cerca de ${Math.floor(after / SMS_PRICE)} mensagens).`,
        at,
        href: "/definicoes",
        unread: true,
      });
    }
    return record;
  },

  requestTopUp: (amount) => {
    const topUp: TopUp = {
      id: `tu-${crypto.randomUUID().slice(0, 8)}`,
      at: nowLuandaLocal(),
      amount,
      reference: reference(),
      status: "A aguardar pagamento",
      by: CURRENT_USER.name,
    };
    set((state) => ({ topUps: [topUp, ...state.topUps] }));
    recordEvent({
      action: `pediu um carregamento de ${formatMoney(amount)} de SMS:`,
      target: { module: "Definições", label: topUp.reference },
      sensitive: true,
      notify: false,
      toast: {
        title: "Referência de pagamento criada",
        description: `${topUp.reference} · ${formatMoney(amount)}. O saldo entra quando o pagamento for confirmado.`,
        tone: "success",
      },
    });
  },

  confirmTopUp: (id) => {
    const topUp = get().topUps.find((item) => item.id === id);
    if (!topUp || topUp.status !== "A aguardar pagamento") return;
    set((state) => ({
      balance: state.balance + topUp.amount,
      topUps: state.topUps.map((item) => (item.id === id ? { ...item, status: "Confirmado" } : item)),
    }));
    recordEvent({
      action: `confirmou o carregamento de ${formatMoney(topUp.amount)} de SMS:`,
      target: { module: "Definições", label: topUp.reference },
      sensitive: true,
      notify: false,
      toast: {
        title: "Saldo carregado",
        description: `+${formatMoney(topUp.amount)} · saldo ${formatMoney(get().balance)}`,
        tone: "success",
      },
    });
  },

  cancelTopUp: (id) =>
    set((state) => ({
      topUps: state.topUps.map((item) =>
        item.id === id && item.status === "A aguardar pagamento" ? { ...item, status: "Cancelado" } : item,
      ),
    })),

  reserve: (campaignId, amount) =>
    set((state) => ({ reservations: { ...state.reservations, [campaignId]: amount } })),

  release: (campaignId) =>
    set((state) => {
      const reservations = { ...state.reservations };
      delete reservations[campaignId];
      return { reservations };
    }),
}));
