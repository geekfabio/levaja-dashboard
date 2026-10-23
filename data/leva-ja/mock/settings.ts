import { ADMIN_ROLES, PERMISSION_GROUPS, ROLE_LABELS, normalizeRolePermissions } from "@/lib/leva-ja/permissions";
import { SETTINGS_SECTION_LABELS, SETTINGS_SECTION_PERMISSION, settingsChanges, validateSettingsSection } from "@/lib/leva-ja/settings";
import type { AuditChange } from "@/types/leva-ja";
import type { SettingsRepository } from "../repositories/settings";
import { RepositoryError } from "../repositories/errors";
import type { MockDatabase } from "./database";
import { requireReason } from "./helpers";

const PERMISSION_LABELS = new Map(PERMISSION_GROUPS.flatMap((group) => group.permissions.map((item) => [item.key, item.label] as const)));

export function createMockSettings(db: MockDatabase): SettingsRepository {
  return {
    get: () => db.run({}, ({ state }) => state.settings),

    update: (section, value, reason) =>
      db.run({ permission: SETTINGS_SECTION_PERMISSION[section] }, (ctx) => {
        const why = requireReason(reason, "o motivo da alteração");
        if (!(section in SETTINGS_SECTION_LABELS)) throw new RepositoryError("validation", "Secção de definições desconhecida.");
        const issues = validateSettingsSection(section, value);
        if (issues.length) throw new RepositoryError("validation", issues[0].message, issues);
        const changes = settingsChanges(section, ctx.state.settings[section], value);
        if (!changes.length) throw new RepositoryError("validation", "Não há alterações para guardar.");
        ctx.state.settings = { ...ctx.state.settings, [section]: structuredClone(value), updatedAt: ctx.nowIso, updatedBy: ctx.session.user.name };
        db.audit(ctx, "settings.update", { kind: "settings", id: section, label: SETTINGS_SECTION_LABELS[section] }, why, changes);
        db.commit();
        return ctx.state.settings;
      }),

    rolePermissions: () => db.run({ permission: "security.manage" }, ({ state }) => state.rolePermissions),

    updateRolePermissions: (matrix, reason) =>
      db.run({ permission: "security.manage" }, (ctx) => {
        const why = requireReason(reason, "o motivo da alteração");
        const next = normalizeRolePermissions(matrix);
        const changes: AuditChange[] = [];
        for (const role of ADMIN_ROLES) {
          const before = new Set(ctx.state.rolePermissions[role]);
          const after = new Set(next[role]);
          const added = next[role].filter((item) => !before.has(item)).map((item) => PERMISSION_LABELS.get(item) ?? item);
          const removed = ctx.state.rolePermissions[role].filter((item) => !after.has(item)).map((item) => PERMISSION_LABELS.get(item) ?? item);
          if (added.length) changes.push({ field: `${ROLE_LABELS[role]}: acrescentado`, from: "—", to: added.join(", ") });
          if (removed.length) changes.push({ field: `${ROLE_LABELS[role]}: retirado`, from: removed.join(", "), to: "—" });
        }
        if (!changes.length) throw new RepositoryError("validation", "Não há alterações para guardar.");
        ctx.state.rolePermissions = next;
        db.audit(ctx, "roles.update", { kind: "roles", id: "roles", label: "Papéis e permissões" }, why, changes);
        db.commit();
        return next;
      }),
  };
}
