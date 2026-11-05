import type { AdminPermission, AdminRole } from "./admin-roles";
import { hasPermission } from "./admin-roles";
import { apiError } from "./envelope";

export function requirePermission(role: AdminRole, permission: AdminPermission) {
  if (!hasPermission(role, permission)) {
    throw apiError("forbidden", "O seu papel não tem permissão para esta acção.");
  }
}
