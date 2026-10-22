import type { AuditRepository } from "../repositories/audit";
import type { MockDatabase } from "./database";
import { byNewest, inRange, matchesQuery, paginate } from "./helpers";

export function createMockAudit(db: MockDatabase): AuditRepository {
  return {
    list: (filters = {}) =>
      db.run({ permission: "audit.view" }, ({ state }) => {
        const items = state.audit
          .filter((entry) => !filters.actorId || entry.actorId === filters.actorId)
          .filter((entry) => !filters.entityKind?.length || filters.entityKind.includes(entry.entity.kind))
          .filter((entry) => !filters.action?.length || filters.action.includes(entry.action))
          .filter((entry) => !filters.entityId || entry.entity.id === filters.entityId)
          .filter((entry) => inRange(entry.at, filters))
          .filter((entry) => matchesQuery(filters.q, entry.entity.label, entry.reason, entry.actorName))
          .sort(byNewest((entry) => entry.at));
        return paginate(items, filters);
      }),
  };
}
