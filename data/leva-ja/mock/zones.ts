import { ACTIVE_STATUSES } from "@/lib/leva-ja/status";
import type { Zone } from "@/types/leva-ja";
import type { ZoneInput, ZonesRepository } from "../repositories/zones";
import { RepositoryError } from "../repositories/errors";
import type { FieldIssue } from "../repositories/errors";
import type { MockState } from "./state";
import type { MockDatabase } from "./database";
import { findOr404, normalizeText, requireReason } from "./helpers";

function validateZone(state: MockState, input: ZoneInput, id?: string): Zone {
  const issues: FieldIssue[] = [];
  const name = input.name.trim();
  if (name.length < 2) issues.push({ field: "name", message: "Indique o nome da zona." });
  if (state.zones.some((zone) => zone.id !== id && normalizeText(zone.name) === normalizeText(name))) {
    issues.push({ field: "name", message: "Já existe uma zona com este nome." });
  }
  const { latitude, longitude } = input.coords;
  if (!Number.isFinite(latitude) || latitude < -9.6 || latitude > -8.3) {
    issues.push({ field: "latitude", message: "A latitude tem de estar na área de Luanda (entre −9,6 e −8,3)." });
  }
  if (!Number.isFinite(longitude) || longitude < 12.9 || longitude > 13.8) {
    issues.push({ field: "longitude", message: "A longitude tem de estar na área de Luanda (entre 12,9 e 13,8)." });
  }
  if (!Number.isFinite(input.radiusKm) || input.radiusKm < 0.5 || input.radiusKm > 25) {
    issues.push({ field: "radiusKm", message: "O raio tem de estar entre 0,5 e 25 km." });
  }
  if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
  return { id: id ?? "", name, coords: { latitude, longitude }, radiusKm: Math.round(input.radiusKm * 10) / 10 };
}

function describe(zone: Zone) {
  return `${zone.coords.latitude.toFixed(4)}, ${zone.coords.longitude.toFixed(4)} · ${zone.radiusKm} km`;
}

export function createMockZones(db: MockDatabase): ZonesRepository {
  return {
    list: () =>
      db.run({}, ({ state }) =>
        state.zones
          .map((zone) => ({
            ...zone,
            providersCount: state.providers.filter((provider) => provider.zoneIds.includes(zone.id)).length,
            activeRequests: state.requests.filter((request) => request.zoneId === zone.id && ACTIVE_STATUSES.includes(request.status)).length,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt")),
      ),

    create: (input, reason) =>
      db.run({ permission: "zones.edit" }, (ctx) => {
        const why = requireReason(reason);
        const zone = { ...validateZone(ctx.state, input), id: db.nextId("zn") };
        ctx.state.zones.push(zone);
        db.audit(ctx, "zone.create", { kind: "zone", id: zone.id, label: zone.name }, why, [{ field: "Zona", from: "—", to: describe(zone) }]);
        db.commit("providers");
        return zone;
      }),

    update: (id, input, reason) =>
      db.run({ permission: "zones.edit" }, (ctx) => {
        const why = requireReason(reason);
        const zone = findOr404(ctx.state.zones, id, "Zona");
        const next = validateZone(ctx.state, input, id);
        const changes = [];
        if (zone.name !== next.name) changes.push({ field: "Nome", from: zone.name, to: next.name });
        if (describe(zone) !== describe(next)) changes.push({ field: "Centro e raio", from: describe(zone), to: describe(next) });
        if (!changes.length) throw new RepositoryError("validation", "Não há alterações para guardar.");
        Object.assign(zone, next);
        db.audit(ctx, "zone.update", { kind: "zone", id: zone.id, label: zone.name }, why, changes);
        db.commit("providers");
        return zone;
      }),

    remove: (id, reason) =>
      db.run({ permission: "zones.edit" }, (ctx) => {
        const why = requireReason(reason);
        const zone = findOr404(ctx.state.zones, id, "Zona");
        const providers = ctx.state.providers.filter((provider) => provider.zoneIds.includes(id)).length;
        const active = ctx.state.requests.filter((request) => request.zoneId === id && ACTIVE_STATUSES.includes(request.status)).length;
        if (providers || active) {
          throw new RepositoryError(
            "validation",
            `Não é possível remover «${zone.name}»: tem ${providers} prestador(es) e ${active} pedido(s) activo(s).`,
          );
        }
        ctx.state.zones = ctx.state.zones.filter((item) => item.id !== id);
        db.audit(ctx, "zone.delete", { kind: "zone", id: zone.id, label: zone.name }, why, [{ field: "Zona", from: describe(zone), to: "Removida" }]);
        db.commit("providers");
      }),
  };
}
