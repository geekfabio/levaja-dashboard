import { CURRENT_USER, OWNERS, TEAMS, ZONES } from "./companies";
import { TEAM_FORECAST, ZONE_FORECAST } from "./forecast";

export type CompanyProfile = {
  tradeName: string;
  legalName: string;
  nif: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
};

export const COMPANY_PROFILE: CompanyProfile = {
  tradeName: "Alimenta Angola — Cash and Carry",
  legalName: "Alimenta Angola, Lda.",
  nif: "5417000000",
  address: "Estrada de Catete, Km 12, Viana",
  city: "Luanda",
  phone: "+244 923 000 000",
  email: "geral@alimentaangola.co.ao",
  website: "https://alimentaangola.co.ao",
};

export const COMPANY_EMAIL_DOMAIN = "alimentaangola.co.ao";

export type SenderSettings = {
  emailName: string;
  emailAddress: string;
  replyTo: string;
  smsSenderId: string;
  windowStart: string;
  windowEnd: string;
};

export const SENDER_SETTINGS: SenderSettings = {
  emailName: "Alimenta Angola",
  emailAddress: `promocoes@${COMPANY_EMAIL_DOMAIN}`,
  replyTo: `comercial@${COMPANY_EMAIL_DOMAIN}`,
  smsSenderId: "ALIMENTA",
  windowStart: "08:00",
  windowEnd: "20:00",
};

export const ZONE_COLORS = ["yellow", "red", "purple", "blue", "green", "teal"] as const;

export type ZoneColor = (typeof ZONE_COLORS)[number];

export const ZONE_COLOR_LABELS: Record<ZoneColor, string> = {
  yellow: "Amarelo",
  red: "Vermelho",
  purple: "Roxo",
  blue: "Azul",
  green: "Verde",
  teal: "Turquesa",
};

export type ZoneSetting = {
  name: string;
  color: ZoneColor;
  quota: number;
  showInSidebar: boolean;
};

export const ZONE_SETTINGS: ZoneSetting[] = ZONES.map((zone, index) => ({
  name: zone,
  color: ZONE_COLORS[index % ZONE_COLORS.length],
  quota: ZONE_FORECAST.find((item) => item.zone === zone)?.quota ?? 0,
  showInSidebar: index < 3,
}));

export const TEAM_ICONS = ["target", "target-alt", "users"] as const;

export type TeamIcon = (typeof TEAM_ICONS)[number];

export const TEAM_ICON_LABELS: Record<TeamIcon, string> = {
  target: "Alvo",
  "target-alt": "Alvo alternativo",
  users: "Pessoas",
};

export type TeamSetting = {
  id: string;
  name: string;
  description: string;
  icon: TeamIcon;
  quota: number;
  showInSidebar: boolean;
};

const TEAM_DESCRIPTIONS = [
  "Hotéis, cantinas e clientes institucionais de grande volume.",
  "Encomendas por telefone e WhatsApp para retalho e revenda.",
  "Visitas diárias às mercearias e restaurantes da zona.",
];

export const TEAM_SETTINGS: TeamSetting[] = TEAMS.map((team, index) => ({
  id: `equipa-${index + 1}`,
  name: team,
  description: TEAM_DESCRIPTIONS[index],
  icon: TEAM_ICONS[index],
  quota: TEAM_FORECAST.find((item) => item.team === team)?.quota ?? 0,
  showInSidebar: true,
}));

export const TEAM_MEMBERSHIPS: Record<string, string> = Object.fromEntries(
  OWNERS.map((owner) => [
    owner.name,
    TEAM_SETTINGS.find((team) => team.name === owner.team)!.id,
  ]),
);

export const ROLES = [
  "Administrador",
  "Gestor comercial",
  "Comercial",
  "Marketing",
  "Leitura",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Administrador: "Tudo, incluindo definições e acessos.",
  "Gestor comercial": "A sua equipa e a sua zona.",
  Comercial: "Os seus clientes.",
  Marketing: "Campanhas e segmentos, sem dados financeiros.",
  Leitura: "Apenas consulta.",
};

export const DATA_SCOPES = [
  "Todos os clientes",
  "Equipa e zona",
  "Os seus clientes",
] as const;

export type DataScope = (typeof DATA_SCOPES)[number];

export const DEFAULT_ROLE_SCOPES: Record<Role, DataScope> = {
  Administrador: "Todos os clientes",
  "Gestor comercial": "Equipa e zona",
  Comercial: "Os seus clientes",
  Marketing: "Todos os clientes",
  Leitura: "Todos os clientes",
};

export const PERMISSIONS = [
  { key: "clientes.ver", group: "Clientes", label: "Ver clientes e contactos" },
  { key: "clientes.editar", group: "Clientes", label: "Criar e editar clientes e contactos" },
  { key: "financeiro.ver", group: "Clientes", label: "Ver valores (carteira, saldo, metas)" },
  { key: "oportunidades.editar", group: "Vendas", label: "Criar e mover oportunidades" },
  { key: "atividades.editar", group: "Vendas", label: "Registar atividades e tarefas" },
  { key: "campanhas.criar", group: "Mensagens", label: "Criar campanhas e modelos" },
  { key: "campanhas.agendar", group: "Mensagens", label: "Agendar envios de e-mail e SMS" },
  { key: "automacoes.gerir", group: "Mensagens", label: "Ativar e pausar automações" },
  { key: "relatorios.ver", group: "Relatórios", label: "Ver relatórios e previsão" },
  { key: "relatorios.exportar", group: "Relatórios", label: "Exportar CSV" },
  { key: "definicoes.gerir", group: "Administração", label: "Gerir definições, equipas e acessos" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

const ALL_PERMISSIONS = PERMISSIONS.map((permission) => permission.key);

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  Administrador: ALL_PERMISSIONS,
  "Gestor comercial": ALL_PERMISSIONS.filter((key) => key !== "definicoes.gerir"),
  Comercial: [
    "clientes.ver",
    "clientes.editar",
    "financeiro.ver",
    "oportunidades.editar",
    "atividades.editar",
    "relatorios.ver",
  ],
  Marketing: [
    "clientes.ver",
    "campanhas.criar",
    "campanhas.agendar",
    "automacoes.gerir",
    "relatorios.ver",
  ],
  Leitura: ["clientes.ver", "relatorios.ver"],
};

export type UserStatus = "Ativo" | "Convite pendente";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  status: UserStatus;
};

export const USERS: AppUser[] = [
  {
    id: "user-0",
    name: CURRENT_USER.name,
    email: CURRENT_USER.email,
    avatar: CURRENT_USER.avatar,
    role: "Administrador",
    status: "Ativo",
  },
  ...OWNERS.map<AppUser>((owner, index) => ({
    id: `user-${index + 1}`,
    name: owner.name,
    email: owner.email,
    avatar: owner.avatar,
    role: owner.role === "Gestor de Conta Sénior" ? "Gestor comercial" : "Comercial",
    status: "Ativo",
  })),
  {
    id: "user-marketing",
    name: "Helena Mateus",
    email: `helena.mateus@${COMPANY_EMAIL_DOMAIN}`,
    role: "Marketing",
    status: "Ativo",
  },
];
