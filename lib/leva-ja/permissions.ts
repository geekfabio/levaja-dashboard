import type { AdminRole } from "@/types/leva-ja";

export type AdminSection =
  | "overview"
  | "requests"
  | "map"
  | "providers"
  | "documents"
  | "clients"
  | "finance"
  | "pricing"
  | "support"
  | "users"
  | "audit"
  | "settings";

export type AdminPermission =
  | "requests.view"
  | "requests.operate"
  | "requests.dispute"
  | "providers.view"
  | "providers.manage"
  | "documents.review"
  | "clients.view"
  | "clients.block"
  | "finance.view"
  | "finance.withdrawals"
  | "pricing.view"
  | "pricing.edit"
  | "zones.edit"
  | "support.tickets"
  | "support.sos"
  | "support.reviews"
  | "users.manage"
  | "audit.view"
  | "metrics.view";

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Administrador",
  operations: "Operações",
  support: "Suporte",
  finance: "Finanças",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  admin: "Acesso total, incluindo utilizadores do painel e auditoria.",
  operations: "Pedidos, mapa, prestadores, documentos e zonas.",
  support: "Ocorrências, alertas SOS, avaliações e clientes.",
  finance: "Receita, levantamentos e transacções.",
};

export const ADMIN_ROLES: readonly AdminRole[] = ["admin", "operations", "support", "finance"];

const ALL_PERMISSIONS: AdminPermission[] = [
  "requests.view",
  "requests.operate",
  "requests.dispute",
  "providers.view",
  "providers.manage",
  "documents.review",
  "clients.view",
  "clients.block",
  "finance.view",
  "finance.withdrawals",
  "pricing.view",
  "pricing.edit",
  "zones.edit",
  "support.tickets",
  "support.sos",
  "support.reviews",
  "users.manage",
  "audit.view",
  "metrics.view",
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  admin: ALL_PERMISSIONS,
  operations: [
    "metrics.view",
    "requests.view",
    "requests.operate",
    "requests.dispute",
    "providers.view",
    "providers.manage",
    "documents.review",
    "clients.view",
    "pricing.view",
    "zones.edit",
    "support.sos",
  ],
  support: [
    "metrics.view",
    "requests.view",
    "requests.dispute",
    "providers.view",
    "clients.view",
    "clients.block",
    "support.tickets",
    "support.sos",
    "support.reviews",
  ],
  finance: ["metrics.view", "requests.view", "providers.view", "finance.view", "finance.withdrawals", "pricing.view"],
};

export const SECTION_PERMISSION: Record<AdminSection, AdminPermission | null> = {
  overview: "metrics.view",
  requests: "requests.view",
  map: "requests.operate",
  providers: "providers.view",
  documents: "documents.review",
  clients: "clients.view",
  finance: "finance.view",
  pricing: "pricing.view",
  support: null,
  users: "users.manage",
  audit: "audit.view",
  settings: null,
};

export function hasPermission(role: AdminRole, permission: AdminPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessSection(role: AdminRole, section: AdminSection) {
  if (section === "support") {
    return hasPermission(role, "support.tickets") || hasPermission(role, "support.sos");
  }
  const permission = SECTION_PERMISSION[section];
  return permission === null || hasPermission(role, permission);
}
