import { apiError } from "./envelope";

export type AdminRole = "admin" | "operations" | "support" | "finance";

export const ADMIN_ROLES: readonly AdminRole[] = ["admin", "operations", "support", "finance"];

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Administrador",
  operations: "Operações",
  support: "Suporte",
  finance: "Finanças",
};

export type AdminPermission =
  | "metrics.view"
  | "requests.view"
  | "requests.operate"
  | "requests.dispute"
  | "reports.view"
  | "providers.view"
  | "providers.manage"
  | "providers.penalize"
  | "applications.manage"
  | "fleets.view"
  | "fleets.manage"
  | "documents.review"
  | "clients.view"
  | "clients.block"
  | "business.view"
  | "business.manage"
  | "finance.view"
  | "finance.withdrawals"
  | "refunds.request"
  | "refunds.decide"
  | "billing.view"
  | "billing.manage"
  | "pricing.view"
  | "pricing.edit"
  | "zones.edit"
  | "promotions.view"
  | "promotions.manage"
  | "support.tickets"
  | "support.sos"
  | "support.reviews"
  | "claims.view"
  | "claims.manage"
  | "communications.send"
  | "users.manage"
  | "security.manage"
  | "privacy.manage"
  | "integrations.manage"
  | "settings.operations"
  | "settings.finance"
  | "settings.manage"
  | "audit.view";

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  "metrics.view",
  "requests.view",
  "requests.operate",
  "requests.dispute",
  "reports.view",
  "providers.view",
  "providers.manage",
  "providers.penalize",
  "applications.manage",
  "fleets.view",
  "fleets.manage",
  "documents.review",
  "clients.view",
  "clients.block",
  "business.view",
  "business.manage",
  "finance.view",
  "finance.withdrawals",
  "refunds.request",
  "refunds.decide",
  "billing.view",
  "billing.manage",
  "pricing.view",
  "pricing.edit",
  "zones.edit",
  "promotions.view",
  "promotions.manage",
  "support.tickets",
  "support.sos",
  "support.reviews",
  "claims.view",
  "claims.manage",
  "communications.send",
  "users.manage",
  "security.manage",
  "privacy.manage",
  "integrations.manage",
  "settings.operations",
  "settings.finance",
  "settings.manage",
  "audit.view",
];

export type RolePermissions = Record<AdminRole, AdminPermission[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: [...ALL_PERMISSIONS],
  operations: [
    "metrics.view",
    "requests.view",
    "requests.operate",
    "requests.dispute",
    "reports.view",
    "providers.view",
    "providers.manage",
    "providers.penalize",
    "applications.manage",
    "fleets.view",
    "fleets.manage",
    "documents.review",
    "clients.view",
    "pricing.view",
    "zones.edit",
    "refunds.request",
    "support.sos",
    "claims.view",
    "claims.manage",
    "communications.send",
    "settings.operations",
  ],
  support: [
    "metrics.view",
    "requests.view",
    "requests.dispute",
    "providers.view",
    "clients.view",
    "clients.block",
    "business.view",
    "refunds.request",
    "promotions.view",
    "support.tickets",
    "support.sos",
    "support.reviews",
    "claims.view",
    "communications.send",
    "privacy.manage",
  ],
  finance: [
    "metrics.view",
    "requests.view",
    "reports.view",
    "providers.view",
    "fleets.view",
    "business.view",
    "business.manage",
    "finance.view",
    "finance.withdrawals",
    "refunds.request",
    "refunds.decide",
    "billing.view",
    "billing.manage",
    "pricing.view",
    "promotions.view",
    "promotions.manage",
    "claims.view",
    "claims.manage",
    "settings.finance",
  ],
};

export function hasPermission(role: AdminRole, permission: AdminPermission) {
  if (role === "admin") return true;
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
}

export function requireAdminRole(role: AdminRole) {
  if (role !== "admin") {
    throw apiError("forbidden", "O seu papel não tem permissão para esta acção.");
  }
}
