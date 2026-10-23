import type { PlatformSettings, RolePermissions, SettingsSection } from "@/types/leva-ja";

export interface SettingsRepository {
  get(): Promise<PlatformSettings>;
  update<K extends SettingsSection>(section: K, value: PlatformSettings[K], reason: string): Promise<PlatformSettings>;
  rolePermissions(): Promise<RolePermissions>;
  updateRolePermissions(matrix: RolePermissions, reason: string): Promise<RolePermissions>;
}
