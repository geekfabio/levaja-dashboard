import { formatAngolanPhone, normalizeAngolanPhone } from "@/lib/phone";
import { FLEET_STATUS_LABELS } from "@/lib/leva-ja/quality";
import type { Fleet } from "@/types/leva-ja";
import type { FleetDetail, FleetsRepository, FleetSummary } from "../repositories/fleets";
import { RepositoryError } from "../repositories/errors";
import type { MockContext, MockDatabase } from "./database";
import { DAY, isSettled, refreshProvider } from "./domain";
import { byNewest, findOr404, matchesQuery, paginate, requireReason } from "./helpers";
import type { MockState } from "./state";

export function fleetSummary(state: MockState, fleet: Fleet, now: number, today: string): FleetSummary {
  const drivers = state.providers.filter((provider) => provider.fleetId === fleet.id);
  const ids = new Set(drivers.map((provider) => provider.id));
  const since = new Date(now - 30 * DAY).toISOString();
  const recent = state.requests.filter((request) => request.providerId && ids.has(request.providerId) && isSettled(request) && request.createdAt >= since);
  const rated = recent.filter((request) => request.rating !== undefined);
  return {
    ...fleet,
    stats: {
      drivers: drivers.length,
      online: drivers.filter((provider) => refreshProvider(state, provider, today).availability === "online").length,
      completed30: recent.length,
      volume30: recent.reduce((sum, request) => sum + request.price.total, 0),
      rating: rated.length ? Math.round((rated.reduce((sum, request) => sum + (request.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    },
  };
}

export function createMockFleets(db: MockDatabase): FleetsRepository {
  const find = (ctx: MockContext, id: string) => findOr404(ctx.state.fleets, id, "Frota");
  const detail = (ctx: MockContext, fleet: Fleet): FleetDetail => ({
    ...fleetSummary(ctx.state, fleet, ctx.now.getTime(), ctx.today),
    drivers: ctx.state.providers.filter((provider) => provider.fleetId === fleet.id).map((provider) => refreshProvider(ctx.state, provider, ctx.today)),
  });

  return {
    list: (filters = {}) =>
      db.run({ permission: "fleets.view" }, (ctx) =>
        paginate(
          ctx.state.fleets
            .filter((fleet) => (!filters.status?.length || filters.status.includes(fleet.status)) && matchesQuery(filters.q, fleet.name, fleet.nif, fleet.contactName))
            .sort(byNewest((fleet) => fleet.createdAt))
            .map((fleet) => fleetSummary(ctx.state, fleet, ctx.now.getTime(), ctx.today)),
          filters,
        ),
      ),

    get: (id) => db.run({ permission: "fleets.view" }, (ctx) => detail(ctx, find(ctx, id))),

    create: (input) =>
      db.run({ permission: "fleets.manage" }, (ctx) => {
        const issues = [
          input.name.trim().length < 2 && { field: "name", message: "Indique o nome da frota." },
          !/^\d{9,14}$/.test(input.nif.trim()) && { field: "nif", message: "O NIF tem entre 9 e 14 dígitos." },
          input.contactName.trim().length < 2 && { field: "contactName", message: "Indique o responsável." },
          !normalizeAngolanPhone(input.phone) && { field: "phone", message: "Indique um telefone de Angola (+244 9XX XXX XXX)." },
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) && { field: "email", message: "Indique um e-mail válido." },
        ].filter((issue): issue is { field: string; message: string } => Boolean(issue));
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        if (ctx.state.fleets.some((fleet) => fleet.nif === input.nif.trim())) {
          throw new RepositoryError("validation", "Já existe uma frota com este NIF.", [{ field: "nif", message: "NIF já registado." }]);
        }
        const fleet: Fleet = {
          id: db.nextId("flt"),
          name: input.name.trim(),
          nif: input.nif.trim(),
          contactName: input.contactName.trim(),
          phone: formatAngolanPhone(normalizeAngolanPhone(input.phone) ?? ""),
          email: input.email.trim().toLowerCase(),
          status: "active",
          createdAt: ctx.nowIso,
        };
        ctx.state.fleets.push(fleet);
        db.audit(ctx, "fleet.create", { kind: "fleet", id: fleet.id, label: fleet.name }, `NIF ${fleet.nif}`);
        db.commit("providers");
        return fleet;
      }),

    addDriver: (id, providerId) =>
      db.run({ permission: "fleets.manage" }, (ctx) => {
        const fleet = find(ctx, id);
        if (fleet.status !== "active") throw new RepositoryError("invalid_transition", "Não é possível acrescentar motoristas a uma frota suspensa.");
        const provider = findOr404(ctx.state.providers, providerId, "Prestador");
        if (provider.fleetId === fleet.id) throw new RepositoryError("validation", "O prestador já pertence a esta frota.");
        if (provider.fleetId) {
          const other = ctx.state.fleets.find((item) => item.id === provider.fleetId);
          throw new RepositoryError("validation", `O prestador já pertence à frota ${other?.name ?? "outra frota"}.`);
        }
        provider.fleetId = fleet.id;
        db.audit(ctx, "fleet.driver_add", { kind: "fleet", id: fleet.id, label: fleet.name }, undefined, [{ field: "Motorista", from: "—", to: provider.name }]);
        db.commit("providers");
        return detail(ctx, fleet);
      }),

    removeDriver: (id, providerId, reason) =>
      db.run({ permission: "fleets.manage" }, (ctx) => {
        const fleet = find(ctx, id);
        const provider = findOr404(ctx.state.providers, providerId, "Prestador");
        if (provider.fleetId !== fleet.id) throw new RepositoryError("validation", "O prestador não pertence a esta frota.");
        const why = requireReason(reason, "o motivo");
        provider.fleetId = undefined;
        db.audit(ctx, "fleet.driver_remove", { kind: "fleet", id: fleet.id, label: fleet.name }, why, [{ field: "Motorista", from: provider.name, to: "—" }]);
        db.commit("providers");
        return detail(ctx, fleet);
      }),

    setStatus: (id, status, reason) =>
      db.run({ permission: "fleets.manage" }, (ctx) => {
        const fleet = find(ctx, id);
        if (fleet.status === status) throw new RepositoryError("invalid_transition", `A frota já está ${FLEET_STATUS_LABELS[status].toLowerCase()}.`);
        const why = requireReason(reason, "o motivo");
        const from = FLEET_STATUS_LABELS[fleet.status];
        fleet.status = status;
        fleet.suspensionReason = status === "suspended" ? why : undefined;
        db.audit(ctx, status === "suspended" ? "fleet.suspend" : "fleet.reactivate", { kind: "fleet", id: fleet.id, label: fleet.name }, why, [
          { field: "Estado", from, to: FLEET_STATUS_LABELS[status] },
        ]);
        db.commit("providers");
        return fleet;
      }),
  };
}
