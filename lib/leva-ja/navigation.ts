import type { AdminRole } from "@/types/leva-ja";
import { canAccessSection } from "./permissions";
import type { AdminSection } from "./permissions";

export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";

export const SECTION_ROUTES: Record<AdminSection, string> = {
  overview: "/admin",
  requests: "/admin/pedidos",
  map: "/admin/mapa",
  providers: "/admin/prestadores",
  documents: "/admin/documentos",
  clients: "/admin/clientes",
  finance: "/admin/financas",
  pricing: "/admin/precos",
  support: "/admin/suporte",
  users: "/admin/utilizadores",
  audit: "/admin/auditoria",
  settings: "/admin/definicoes",
};

export const SECTION_LABELS: Record<AdminSection, string> = {
  overview: "Visão geral",
  requests: "Pedidos",
  map: "Mapa operacional",
  providers: "Prestadores",
  documents: "Validação de documentos",
  clients: "Clientes",
  finance: "Finanças",
  pricing: "Preços e zonas",
  support: "Suporte",
  users: "Utilizadores do painel",
  audit: "Auditoria",
  settings: "Definições",
};

export const SECTION_DESCRIPTIONS: Record<AdminSection, string> = {
  overview: "Indicadores do dia e da semana e o que precisa de atenção.",
  requests: "Todos os pedidos, com filtros, detalhe e acções de operação.",
  map: "Prestadores online e pedidos activos sobre Luanda.",
  providers: "Contas de prestadores, documentos, cobertura e carteira.",
  documents: "Fila de documentos por validar e documentos a expirar.",
  clients: "Clientes da app, pedidos, pagamentos e bloqueios.",
  finance: "Receita, levantamentos e transacções.",
  pricing: "Tabela de preços, extras, taxa, comissão e zonas.",
  support: "Ocorrências, alertas SOS e avaliações baixas.",
  users: "Administradores do painel e os seus papéis.",
  audit: "Registo de quem fez o quê, quando e porquê.",
  settings: "Preferências do painel e dados de demonstração.",
};

export type NavGroup = { title?: string; sections: AdminSection[] };

export const NAV_GROUPS: NavGroup[] = [
  { sections: ["overview", "requests", "map"] },
  { title: "Rede", sections: ["providers", "documents", "clients"] },
  { title: "Negócio", sections: ["finance", "pricing"] },
  { title: "Apoio", sections: ["support"] },
];

export const NAV_FOOTER: AdminSection[] = ["users", "audit", "settings"];

const ORDERED_SECTIONS = Object.keys(SECTION_ROUTES) as AdminSection[];

export function sectionForPath(pathname: string): AdminSection | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === ADMIN_HOME) return "overview";
  const match = ORDERED_SECTIONS.filter((section) => section !== "overview").find(
    (section) => clean === SECTION_ROUTES[section] || clean.startsWith(`${SECTION_ROUTES[section]}/`),
  );
  return match ?? null;
}

export function firstAllowedRoute(role: AdminRole) {
  const section = ORDERED_SECTIONS.find((item) => canAccessSection(role, item));
  return section ? SECTION_ROUTES[section] : SECTION_ROUTES.settings;
}

export function safeNextRoute(next: string | null, role: AdminRole) {
  if (!next || !next.startsWith(`${ADMIN_HOME}`) || next.startsWith(ADMIN_LOGIN) || next.startsWith("//")) {
    return firstAllowedRoute(role);
  }
  const section = sectionForPath(next.split("?")[0]);
  return section && canAccessSection(role, section) ? next : firstAllowedRoute(role);
}
