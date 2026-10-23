import type { AdminRole } from "@/types/leva-ja";
import { canAccessSection } from "./permissions";
import type { AdminSection } from "./permissions";

export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";

export const SECTION_ROUTES: Record<AdminSection, string> = {
  overview: "/admin",
  requests: "/admin/pedidos",
  scheduled: "/admin/agendados",
  disputes: "/admin/disputas",
  map: "/admin/mapa",
  applications: "/admin/candidaturas",
  providers: "/admin/prestadores",
  fleets: "/admin/frotas",
  documents: "/admin/documentos",
  clients: "/admin/clientes",
  business: "/admin/empresas",
  finance: "/admin/financas",
  billing: "/admin/facturacao",
  refunds: "/admin/reembolsos",
  pricing: "/admin/precos",
  promotions: "/admin/promocoes",
  support: "/admin/suporte",
  claims: "/admin/sinistros",
  communications: "/admin/comunicacoes",
  reports: "/admin/relatorios",
  users: "/admin/utilizadores",
  privacy: "/admin/proteccao-dados",
  integrations: "/admin/integracoes",
  audit: "/admin/auditoria",
  settings: "/admin/definicoes",
};

export const SECTION_LABELS: Record<AdminSection, string> = {
  overview: "Visão geral",
  requests: "Pedidos",
  scheduled: "Agendados",
  disputes: "Disputas",
  map: "Mapa operacional",
  applications: "Candidaturas",
  providers: "Prestadores",
  fleets: "Frotas",
  documents: "Validação de documentos",
  clients: "Clientes",
  business: "Contas empresariais",
  finance: "Finanças",
  billing: "Facturação",
  refunds: "Reembolsos",
  pricing: "Preços e zonas",
  promotions: "Promoções e cupões",
  support: "Suporte",
  claims: "Sinistros",
  communications: "Comunicações",
  reports: "Relatórios",
  users: "Utilizadores do painel",
  privacy: "Protecção de dados",
  integrations: "Integrações",
  audit: "Auditoria",
  settings: "Definições",
};

export const SECTION_DESCRIPTIONS: Record<AdminSection, string> = {
  overview: "Indicadores do dia e da semana e o que precisa de atenção.",
  requests: "Todos os pedidos, com filtros, detalhe e acções de operação.",
  scheduled: "Pedidos marcados para mais tarde, dia a dia.",
  disputes: "Pedidos contestados, para resolver com ou sem reembolso.",
  map: "Prestadores online, pedidos activos e procura sobre Luanda.",
  applications: "Inscrições de novos prestadores até à aprovação.",
  providers: "Contas de prestadores, documentos, cobertura, qualidade e carteira.",
  fleets: "Empresas com várias viaturas e motoristas.",
  documents: "Fila de documentos por validar e documentos a expirar.",
  clients: "Clientes da app, pedidos, pagamentos e bloqueios.",
  business: "Seguradoras, frotas e lojas com crédito e factura mensal.",
  finance: "Receita, levantamentos, lotes de pagamento, reconciliação e numerário.",
  billing: "Facturas e notas de crédito com IVA.",
  refunds: "Pedidos de reembolso, aprovação e processamento.",
  pricing: "Tabela de preços, extras, taxa, comissão e zonas.",
  promotions: "Cupões de desconto e programa de convites.",
  support: "Ocorrências, alertas SOS e avaliações baixas.",
  claims: "Danos, acidentes e outros sinistros durante os serviços.",
  communications: "Avisos por notificação e SMS para clientes e prestadores.",
  reports: "Retenção, funil da app e desempenho por zona e prestador.",
  users: "Administradores do painel, sessões activas e acessos.",
  privacy: "Pedidos de acesso, rectificação e apagamento de dados (Lei n.º 22/11).",
  integrations: "Chaves da API, webhooks e fornecedores externos.",
  audit: "Registo de quem fez o quê, quando e porquê.",
  settings: "Plataforma, regras de operação, pagamentos, papéis e dados de demonstração.",
};

export type NavGroup = { title?: string; sections: AdminSection[] };

export const NAV_GROUPS: NavGroup[] = [
  { sections: ["overview", "requests", "scheduled", "disputes", "map"] },
  { title: "Rede", sections: ["applications", "providers", "fleets", "documents", "clients"] },
  { title: "Negócio", sections: ["finance", "billing", "refunds", "pricing"] },
  { title: "Apoio", sections: ["support", "claims"] },
];

export const NAV_FOOTER: AdminSection[] = ["users", "audit", "settings"];

export const NAV_SECTIONS: AdminSection[] = [...NAV_GROUPS.flatMap((group) => group.sections), ...NAV_FOOTER];

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
