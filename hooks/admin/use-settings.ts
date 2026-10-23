"use client";

import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/data/leva-ja";
import { SETTINGS_SECTION_LABELS } from "@/lib/leva-ja/settings";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import type { PlatformSettings, RolePermissions, SettingsSection } from "@/types/leva-ja";
import { useAdminMutation } from "./use-admin-mutation";

export function usePlatformSettings() {
  return useQuery({ queryKey: ["admin", "settings"], queryFn: () => repositories().settings.get(), staleTime: 60_000 });
}

export function useUpdateSettings<K extends SettingsSection>(section: K) {
  return useAdminMutation(
    ({ value, reason }: { value: PlatformSettings[K]; reason: string }) => repositories().settings.update(section, value, reason),
    { success: "Definições guardadas", description: `${SETTINGS_SECTION_LABELS[section]}: a alteração ficou registada na auditoria.` },
  );
}

export function useRolePermissions(enabled: boolean) {
  return useQuery({ queryKey: ["admin", "roles"], queryFn: () => repositories().settings.rolePermissions(), enabled });
}

export function useUpdateRolePermissions() {
  return useAdminMutation(
    async ({ matrix, reason }: { matrix: RolePermissions; reason: string }) => {
      const next = await repositories().settings.updateRolePermissions(matrix, reason);
      useAdminSessionStore.getState().setRolePermissions(next);
      return next;
    },
    { success: "Permissões actualizadas", description: "Aplicam-se na próxima acção de cada utilizador." },
  );
}
