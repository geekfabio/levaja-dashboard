import { luandaDay } from "@/lib/format";
import { dispatchStartsAt, scheduleRisk, slaStats } from "@/lib/leva-ja/scheduling";
import { SERVICE_KINDS } from "@/lib/leva-ja/services";
import type { OperationsRepository, SlaBreach } from "../repositories/operations";
import type { MockDatabase } from "./database";
import { DAY, MINUTE, addDays, eventAt, hydrateRequest } from "./domain";
import { daysBetween } from "./finance";
import { inRange } from "./helpers";
import type { MockState, StoredRequest } from "./state";

function luandaHour(iso: string) {
  return (new Date(iso).getUTCHours() + 1) % 24;
}

type Timing = { request: StoredRequest; assign?: number; arrival?: number };

function timings(state: MockState, from: string, to: string): Timing[] {
  const lead = state.settings.dispatch.scheduleLeadMinutes;
  return state.requests
    .filter((request) => inRange(request.createdAt, { from, to }))
    .map((request) => {
      const assigned = eventAt(request, "assigned");
      const arrived = eventAt(request, "arrived");
      return {
        request,
        assign: assigned ? Math.max(0, Math.round((Date.parse(assigned) - dispatchStartsAt(request, lead)) / MINUTE)) : undefined,
        arrival: assigned && arrived ? Math.max(0, Math.round((Date.parse(arrived) - Date.parse(assigned)) / MINUTE)) : undefined,
      };
    });
}

function statsOf(items: Timing[], targets: { assign: number; arrival: number }) {
  return {
    assign: slaStats(items.flatMap((item) => (item.assign === undefined ? [] : [item.assign])), targets.assign),
    arrival: slaStats(items.flatMap((item) => (item.arrival === undefined ? [] : [item.arrival])), targets.arrival),
  };
}

export function createMockOperations(db: MockDatabase): OperationsRepository {
  return {
    scheduled: (filters = {}) =>
      db.run({ permission: "requests.view" }, ({ state, now, today }) => {
        const nowMs = now.getTime();
        const horizon = nowMs + (filters.days ?? 14) * DAY;
        const upcoming = state.requests
          .filter((request) => request.scheduledFor && (request.status === "searching" || request.status === "assigned"))
          .filter((request) => Date.parse(request.scheduledFor ?? "") >= nowMs - 2 * 3_600_000 && Date.parse(request.scheduledFor ?? "") <= horizon)
          .filter((request) => !filters.zone?.length || filters.zone.includes(request.zoneId))
          .sort((a, b) => ((a.scheduledFor ?? "") < (b.scheduledFor ?? "") ? -1 : 1));
        const items = upcoming.filter((request) => {
          if (filters.state === "unassigned") return !request.providerId;
          if (filters.state === "assigned") return Boolean(request.providerId);
          if (filters.state === "risk") return scheduleRisk(request, nowMs);
          return true;
        });
        const weekEnd = addDays(today, 6);
        return {
          items: items.map((request) => hydrateRequest(state, request, today)),
          totals: {
            today: upcoming.filter((request) => luandaDay(request.scheduledFor ?? "") === today).length,
            next7: upcoming.filter((request) => luandaDay(request.scheduledFor ?? "") <= weekEnd).length,
            unassigned: upcoming.filter((request) => !request.providerId).length,
            risk: upcoming.filter((request) => scheduleRisk(request, nowMs)).length,
          },
        };
      }),

    sla: (range) =>
      db.run({ permission: "requests.view" }, ({ state }) => {
        const from = range.from.slice(0, 10);
        const to = range.to.slice(0, 10);
        const targets = { assign: state.settings.dispatch.assignTargetMinutes, arrival: state.settings.dispatch.arrivalTargetMinutes };
        const items = timings(state, from, to);
        const zoneName = (id: string) => state.zones.find((zone) => zone.id === id)?.name ?? "—";
        const breaches: SlaBreach[] = items
          .flatMap((item) => {
            const base = { requestId: item.request.id, code: item.request.code, kind: item.request.kind, zoneName: zoneName(item.request.zoneId), at: item.request.createdAt };
            const list: SlaBreach[] = [];
            if (item.assign !== undefined && item.assign > targets.assign) list.push({ ...base, metric: "assign", minutes: item.assign, target: targets.assign });
            if (item.arrival !== undefined && item.arrival > targets.arrival) list.push({ ...base, metric: "arrival", minutes: item.arrival, target: targets.arrival });
            return list;
          })
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .slice(0, 40);
        return {
          from,
          to,
          targets,
          ...statsOf(items, targets),
          byZone: state.zones.map((zone) => ({ zoneId: zone.id, zoneName: zone.name, ...statsOf(items.filter((item) => item.request.zoneId === zone.id), targets) })),
          byService: SERVICE_KINDS.map((kind) => ({ kind, ...statsOf(items.filter((item) => item.request.kind === kind), targets) })),
          daily: daysBetween(from, to).map((date) => {
            const day = items.filter((item) => luandaDay(item.request.createdAt) === date);
            const stats = statsOf(day, targets);
            return { date, assignWithin: stats.assign.withinRate, arrivalWithin: stats.arrival.withinRate, count: day.length };
          }),
          breaches,
        };
      }),

    heatmap: (query) =>
      db.run({ permission: "requests.view" }, ({ state, now }) => {
        const since = new Date(now.getTime() - query.days * DAY).toISOString();
        const hourMatches = (iso: string) => query.hour === undefined || query.hour === null || luandaHour(iso) === query.hour;
        const demandRequests = state.requests.filter((request) => request.createdAt >= since && hourMatches(request.createdAt));
        const active = state.providers.filter((provider) => provider.accountStatus === "active");
        const grid = new Map<string, { latitude: number; longitude: number; weight: number }>();
        const add = (latitude: number, longitude: number) => {
          const key = `${Math.round(latitude * 100)}:${Math.round(longitude * 100)}`;
          const cell = grid.get(key) ?? { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100, weight: 0 };
          cell.weight += 1;
          grid.set(key, cell);
        };
        if (query.kind === "demand") for (const request of demandRequests) add(request.origin.coords.latitude, request.origin.coords.longitude);
        else for (const provider of active.filter((item) => item.availability === "online")) add(provider.coords.latitude, provider.coords.longitude);
        const points = [...grid.values()];
        return {
          points,
          max: points.reduce((max, point) => Math.max(max, point.weight), 0),
          zones: state.zones
            .map((zone) => {
              const demand = demandRequests.filter((request) => request.zoneId === zone.id).length;
              const supply = active.filter((provider) => provider.zoneIds.includes(zone.id)).length;
              return { zoneId: zone.id, zoneName: zone.name, demand, supply, ratio: supply ? Math.round((demand / supply) * 10) / 10 : null };
            })
            .sort((a, b) => (b.ratio ?? Infinity) - (a.ratio ?? Infinity)),
        };
      }),
  };
}
