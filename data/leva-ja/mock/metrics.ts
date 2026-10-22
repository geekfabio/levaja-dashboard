import { luandaDay } from "@/lib/format";
import { SERVICE_KINDS } from "@/lib/leva-ja/services";
import { ACTIVE_STATUSES, COMPLETED_STATUSES, STATUS_FLOW } from "@/lib/leva-ja/status";
import type { DateRange } from "../repositories/common";
import type { MetricsRepository, Overview, OverviewKpis } from "../repositories/metrics";
import type { MockDatabase } from "./database";
import { DAY, MINUTE, addDays, commissionOf, eventAt, hydrateRequest, isSettled } from "./domain";
import { reviewQueue } from "./documents";
import { daysBetween } from "./finance";
import { byNewest, inRange } from "./helpers";
import type { MockState, StoredRequest } from "./state";

function kpis(state: MockState, requests: StoredRequest[]): OverviewKpis {
  const settled = requests.filter(isSettled);
  const fees = settled.reduce((sum, request) => sum + request.price.platformFee, 0);
  const commissions = settled.reduce((sum, request) => sum + commissionOf(request), 0);
  const assignTimes = requests
    .map((request) => {
      const assigned = request.timeline.find((event) => event.status === "assigned")?.at;
      return assigned ? (Date.parse(assigned) - Date.parse(request.createdAt)) / MINUTE : null;
    })
    .filter((value): value is number => value !== null);
  const ratings = requests.map((request) => request.rating).filter((value): value is number => value !== undefined);
  return {
    requests: requests.length,
    inProgress: requests.filter((request) => ACTIVE_STATUSES.includes(request.status)).length,
    completed: requests.filter((request) => COMPLETED_STATUSES.includes(request.status)).length,
    cancelled: requests.filter((request) => request.status === "cancelled").length,
    platformRevenue: fees + commissions,
    fees,
    commissions,
    volume: settled.reduce((sum, request) => sum + request.price.total, 0),
    avgAssignMinutes: assignTimes.length ? Math.round((assignTimes.reduce((a, b) => a + b, 0) / assignTimes.length) * 10) / 10 : null,
    providersOnline: state.providers.filter((provider) => provider.availability === "online" && provider.accountStatus === "active").length,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
  };
}

export function overviewReport(state: MockState, range: Required<DateRange>): Overview {
  const from = range.from.slice(0, 10);
  const to = range.to.slice(0, 10);
  const span = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY) + 1;
  const previousRange = { from: addDays(from, -span), to: addDays(from, -1) };
  const current = state.requests.filter((request) => inRange(request.createdAt, { from, to }));
  const previous = state.requests.filter((request) => inRange(request.createdAt, previousRange));
  const daily = daysBetween(from, to).map((date) => ({ date, total: 0, completed: 0, cancelled: 0, revenue: 0 }));
  const index = new Map(daily.map((point, position) => [point.date, position]));
  for (const request of current) {
    const point = daily[index.get(luandaDay(request.createdAt)) ?? -1];
    if (!point) continue;
    point.total += 1;
    if (COMPLETED_STATUSES.includes(request.status)) point.completed += 1;
    if (request.status === "cancelled") point.cancelled += 1;
    if (isSettled(request)) point.revenue += request.price.platformFee + commissionOf(request);
  }
  return {
    from,
    to,
    kpis: kpis(state, current),
    previous: kpis(state, previous),
    daily,
    byService: SERVICE_KINDS.map((kind) => {
      const own = current.filter((request) => request.kind === kind);
      return { kind, count: own.length, volume: own.filter(isSettled).reduce((sum, request) => sum + request.price.total, 0) };
    }),
    funnel: STATUS_FLOW.map((status) => ({
      status,
      count: current.filter((request) => eventAt(request, status) !== undefined).length,
    })),
  };
}

export function createMockMetrics(db: MockDatabase): MetricsRepository {
  return {
    overview: (range) => db.run({ permission: "metrics.view" }, ({ state }) => overviewReport(state, range)),

    attention: () =>
      db.run({ permission: "metrics.view" }, ({ state, now, today }) => {
        const threshold = now.getTime() - state.settings.dispatch.stalledAfterMinutes * MINUTE;
        const documents = reviewQueue(state);
        const withdrawals = state.withdrawals
          .filter((withdrawal) => withdrawal.status === "pending")
          .sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1));
        return {
          stalledSearching: state.requests
            .filter((request) => request.status === "searching" && Date.parse(request.createdAt) <= threshold)
            .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
            .map((request) => hydrateRequest(state, request, today)),
          openSos: state.sos.filter((alert) => alert.status !== "resolved").sort(byNewest((alert) => alert.createdAt)),
          pendingDocuments: documents.slice(0, 5),
          pendingDocumentsTotal: documents.length,
          pendingWithdrawals: withdrawals.slice(0, 5),
          pendingWithdrawalsTotal: withdrawals.length,
        };
      }),
  };
}
