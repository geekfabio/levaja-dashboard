import { documentsVerified } from "@/lib/leva-ja/eligibility";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import { luandaDay, shiftDay } from "@/lib/format";
import type { Client, ClientAccount, Provider, ProviderAccount, Refund, Review, ServiceRequest } from "@/types/leva-ja";
import type { TransactionRecord } from "../repositories/finance";
import type { MockState, StoredRequest } from "./state";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function isoAt(ms: number) {
  return new Date(ms).toISOString();
}

export function luandaMidnight(now: Date) {
  return new Date(`${luandaDay(now)}T00:00:00+01:00`).getTime();
}

export function addDays(day: string, days: number) {
  return shiftDay(day, days);
}

export function toClient(account: ClientAccount): Client {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    initials: account.initials,
    rating: account.rating,
    avatar: account.avatar,
  };
}

export function toProvider(account: ProviderAccount): Provider {
  return {
    id: account.id,
    name: account.name,
    initials: account.initials,
    phone: account.phone,
    rating: account.rating,
    reviewsCount: account.reviewsCount,
    verified: account.verified,
    avatar: account.avatar,
    vehicle: account.vehicle,
    coords: account.coords,
  };
}

export function eventAt(request: Pick<StoredRequest, "timeline">, status: StoredRequest["status"]) {
  for (let index = request.timeline.length - 1; index >= 0; index -= 1) {
    if (request.timeline[index].status === status) return request.timeline[index].at;
  }
  return undefined;
}

export function commissionOf(request: Pick<StoredRequest, "price" | "providerEarning">) {
  return request.price.total - request.price.platformFee - request.providerEarning;
}

export function isSettled(request: Pick<StoredRequest, "status">) {
  return request.status === "paid" || request.status === "rated";
}

export function syncRequestTransactions(state: MockState, request: StoredRequest) {
  const ids = [`tx-${request.id}-earning`, `tx-${request.id}-fee`];
  const settled = isSettled(request);
  const delivered = request.status === "delivered";
  if (!request.providerId || (!settled && !delivered)) {
    state.transactions = state.transactions.filter((transaction) => !ids.includes(transaction.id));
    return;
  }
  const provider = state.providers.find((item) => item.id === request.providerId);
  const at = eventAt(request, settled ? "paid" : "delivered") ?? request.createdAt;
  const status = settled ? "completed" : "pending";
  const serviceValue = request.price.total - request.price.platformFee;
  const records: TransactionRecord[] = [
    {
      id: ids[0],
      kind: "earning",
      title: `Serviço ${request.code} — ${SERVICE_SHORT_LABELS[request.kind]}`,
      amount: serviceValue,
      at,
      status,
      serviceKind: request.kind,
      providerId: request.providerId,
      providerName: provider?.name ?? "",
      requestId: request.id,
    },
    {
      id: ids[1],
      kind: "fee",
      title: `Comissão ${request.code}`,
      amount: -commissionOf(request),
      at,
      status,
      serviceKind: request.kind,
      providerId: request.providerId,
      providerName: provider?.name ?? "",
      requestId: request.id,
    },
  ];
  state.transactions = state.transactions.filter((transaction) => !ids.includes(transaction.id));
  state.transactions.push(...records);
}

export function providerBalance(state: MockState, providerId: string) {
  return state.transactions
    .filter((transaction) => transaction.providerId === providerId && transaction.status === "completed")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function reservedWithdrawals(state: MockState, providerId: string, exceptId?: string) {
  return state.withdrawals
    .filter(
      (withdrawal) =>
        withdrawal.providerId === providerId &&
        withdrawal.id !== exceptId &&
        (withdrawal.status === "pending" || withdrawal.status === "approved"),
    )
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
}

export function reviewFromRequest(request: StoredRequest, client: ClientAccount | undefined): Review | null {
  if (request.rating === undefined) return null;
  return {
    id: `rv-${request.id}`,
    requestId: request.id,
    authorName: client?.name ?? "Cliente",
    authorInitials: client?.initials ?? "CL",
    rating: request.rating,
    comment: request.review ?? "",
    at: eventAt(request, "rated") ?? request.createdAt,
  };
}

export function requiredDocuments(state: MockState) {
  return state.settings.documents.requirements.filter((item) => item.required).map((item) => item.icon);
}

export function refreshProvider(state: MockState, provider: ProviderAccount, today: string): ProviderAccount {
  const own = state.requests.filter((request) => request.providerId === provider.id);
  const rated = own.filter((request) => request.rating !== undefined);
  const settled = own.filter(isSettled);
  const rating = rated.length
    ? Math.round((rated.reduce((sum, request) => sum + (request.rating ?? 0), 0) / rated.length) * 10) / 10
    : provider.rating;
  return {
    ...provider,
    verified: documentsVerified(provider, today, requiredDocuments(state)),
    rating,
    reviewsCount: rated.length,
    completedCount: settled.length,
    totalEarnings: settled.reduce((sum, request) => sum + request.providerEarning, 0),
    balance: providerBalance(state, provider.id),
  };
}

export function refreshClient(state: MockState, client: ClientAccount): ClientAccount {
  const own = state.requests.filter((request) => request.clientId === client.id);
  return {
    ...client,
    requestsCount: own.length,
    totalSpent: own.filter(isSettled).reduce((sum, request) => sum + request.price.total, 0),
  };
}

export function hydrateRequest(state: MockState, request: StoredRequest, today: string): ServiceRequest {
  const client = state.clients.find((item) => item.id === request.clientId);
  const provider = request.providerId ? state.providers.find((item) => item.id === request.providerId) : undefined;
  return {
    ...request,
    client: client ? toClient(client) : undefined,
    provider: provider ? toProvider(refreshProvider(state, provider, today)) : undefined,
  };
}

export function syncRefundTransaction(state: MockState, refund: Refund) {
  const id = `tx-${refund.id}`;
  state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
  if (refund.status !== "paid" || !refund.chargeProvider || !refund.providerId) return;
  const request = state.requests.find((item) => item.id === refund.requestId);
  state.transactions.push({
    id,
    kind: "refund",
    title: `Reembolso ${refund.code} — ${refund.requestCode}`,
    amount: -refund.amount,
    at: refund.paidAt ?? refund.requestedAt,
    status: "completed",
    serviceKind: request?.kind,
    providerId: refund.providerId,
    providerName: refund.providerName ?? "",
    requestId: refund.requestId,
  });
}
