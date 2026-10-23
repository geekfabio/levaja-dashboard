import type { AdminPermission, AdminRole, RolePermissions } from "@/types/leva-ja";

export type { AdminPermission } from "@/types/leva-ja";

export type AdminSection =
  | "overview"
  | "requests"
  | "scheduled"
  | "disputes"
  | "map"
  | "applications"
  | "providers"
  | "fleets"
  | "documents"
  | "clients"
  | "business"
  | "finance"
  | "billing"
  | "refunds"
  | "pricing"
  | "promotions"
  | "support"
  | "claims"
  | "communications"
  | "reports"
  | "users"
  | "privacy"
  | "integrations"
  | "audit"
  | "settings";

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Administrador",
  operations: "Operações",
  support: "Suporte",
  finance: "Finanças",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  admin: "Acesso total, incluindo utilizadores do painel, segurança e auditoria.",
  operations: "Pedidos, mapa, prestadores, candidaturas, frotas, documentos e zonas.",
  support: "Ocorrências, alertas SOS, avaliações, clientes e protecção de dados.",
  finance: "Receita, facturação, reembolsos, levantamentos e contas empresariais.",
};

export const ADMIN_ROLES: readonly AdminRole[] = ["admin", "operations", "support", "finance"];

export const PERMISSION_GROUPS: { title: string; permissions: { key: AdminPermission; label: string }[] }[] = [
  {
    title: "Operação",
    permissions: [
      { key: "metrics.view", label: "Ver a visão geral" },
      { key: "requests.view", label: "Ver pedidos" },
      { key: "requests.operate", label: "Reatribuir, cancelar e forçar conclusão" },
      { key: "requests.dispute", label: "Abrir e resolver disputas" },
      { key: "reports.view", label: "Ver relatórios" },
    ],
  },
  {
    title: "Rede",
    permissions: [
      { key: "providers.view", label: "Ver prestadores" },
      { key: "providers.manage", label: "Aprovar, suspender e reactivar prestadores" },
      { key: "providers.penalize", label: "Aplicar penalizações" },
      { key: "applications.manage", label: "Gerir candidaturas" },
      { key: "fleets.view", label: "Ver frotas e empresas" },
      { key: "fleets.manage", label: "Gerir frotas e empresas" },
      { key: "documents.review", label: "Validar documentos" },
      { key: "clients.view", label: "Ver clientes" },
      { key: "clients.block", label: "Bloquear e desbloquear clientes" },
      { key: "business.view", label: "Ver contas empresariais" },
      { key: "business.manage", label: "Gerir contas empresariais" },
    ],
  },
  {
    title: "Negócio",
    permissions: [
      { key: "finance.view", label: "Ver finanças" },
      { key: "finance.withdrawals", label: "Decidir levantamentos e lotes de pagamento" },
      { key: "refunds.request", label: "Pedir reembolsos" },
      { key: "refunds.decide", label: "Aprovar e processar reembolsos" },
      { key: "billing.view", label: "Ver facturação" },
      { key: "billing.manage", label: "Anular facturas e reconciliar pagamentos" },
      { key: "pricing.view", label: "Ver preços" },
      { key: "pricing.edit", label: "Alterar preços" },
      { key: "zones.edit", label: "Alterar zonas" },
      { key: "promotions.view", label: "Ver promoções" },
      { key: "promotions.manage", label: "Gerir promoções e cupões" },
    ],
  },
  {
    title: "Apoio",
    permissions: [
      { key: "support.tickets", label: "Tratar ocorrências" },
      { key: "support.sos", label: "Tratar alertas SOS" },
      { key: "support.reviews", label: "Rever avaliações baixas" },
      { key: "claims.view", label: "Ver sinistros" },
      { key: "claims.manage", label: "Decidir sinistros" },
      { key: "communications.send", label: "Enviar comunicações" },
    ],
  },
  {
    title: "Sistema",
    permissions: [
      { key: "users.manage", label: "Gerir utilizadores do painel" },
      { key: "security.manage", label: "Gerir segurança e sessões" },
      { key: "privacy.manage", label: "Tratar pedidos de dados pessoais" },
      { key: "integrations.manage", label: "Gerir integrações" },
      { key: "settings.operations", label: "Alterar definições de operação" },
      { key: "settings.finance", label: "Alterar definições financeiras" },
      { key: "settings.manage", label: "Alterar as restantes definições" },
      { key: "audit.view", label: "Ver auditoria" },
    ],
  },
];

export const ALL_PERMISSIONS: readonly AdminPermission[] = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((item) => item.key));

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

export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

export const SECTION_PERMISSION: Record<AdminSection, AdminPermission | null> = {
  overview: "metrics.view",
  requests: "requests.view",
  scheduled: "requests.view",
  disputes: "requests.dispute",
  map: "requests.operate",
  applications: "applications.manage",
  providers: "providers.view",
  fleets: "fleets.view",
  documents: "documents.review",
  clients: "clients.view",
  business: "business.view",
  finance: "finance.view",
  billing: "billing.view",
  refunds: "refunds.request",
  pricing: "pricing.view",
  promotions: "promotions.view",
  support: null,
  claims: "claims.view",
  communications: "communications.send",
  reports: "reports.view",
  users: "users.manage",
  privacy: "privacy.manage",
  integrations: "integrations.manage",
  audit: "audit.view",
  settings: null,
};

let activeMatrix: Partial<RolePermissions> = {};

export function applyRolePermissions(matrix: Partial<RolePermissions> | undefined) {
  activeMatrix = matrix ?? {};
}

export function normalizeRolePermissions(matrix: Partial<RolePermissions> = {}): RolePermissions {
  const known = new Set<AdminPermission>(ALL_PERMISSIONS);
  return {
    admin: [...ALL_PERMISSIONS],
    operations: (matrix.operations ?? DEFAULT_ROLE_PERMISSIONS.operations).filter((item) => known.has(item)),
    support: (matrix.support ?? DEFAULT_ROLE_PERMISSIONS.support).filter((item) => known.has(item)),
    finance: (matrix.finance ?? DEFAULT_ROLE_PERMISSIONS.finance).filter((item) => known.has(item)),
  };
}

export function permissionsOf(role: AdminRole, matrix: Partial<RolePermissions> = activeMatrix): readonly AdminPermission[] {
  if (role === "admin") return ALL_PERMISSIONS;
  return matrix[role] ?? DEFAULT_ROLE_PERMISSIONS[role];
}

export function hasPermission(role: AdminRole, permission: AdminPermission, matrix?: Partial<RolePermissions>) {
  return permissionsOf(role, matrix).includes(permission);
}

export function canAccessSection(role: AdminRole, section: AdminSection, matrix?: Partial<RolePermissions>) {
  if (section === "support") {
    return hasPermission(role, "support.tickets", matrix) || hasPermission(role, "support.sos", matrix) || hasPermission(role, "support.reviews", matrix);
  }
  const permission = SECTION_PERMISSION[section];
  return permission === null || hasPermission(role, permission, matrix);
}
