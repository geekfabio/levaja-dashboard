import type { Metadata } from "next";

export const SITE_NAME = "Alimenta Angola CRM";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://crm.alimentaangola.co.ao";
export const SITE_DESCRIPTION =
  "CRM da Alimenta Angola — carteira de clientes, oportunidades e campanhas da equipa comercial.";
export const DEFAULT_OG_IMAGE = "/opengraph-image.jpg";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export type SiteRoute = {
  path: string;
  title: string;
  description: string;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

export const SITE_ROUTES: SiteRoute[] = [
  {
    path: "/",
    title: "Clientes",
    description: SITE_DESCRIPTION,
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/oportunidades",
    title: "Oportunidades",
    description: "Funil de oportunidades comerciais em curso.",
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    path: "/previsao",
    title: "Previsão",
    description: "Previsão de vendas por gestor e por zona.",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    path: "/atividades",
    title: "Atividades",
    description: "Visitas, chamadas e outras interações com os clientes.",
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    path: "/contactos",
    title: "Contactos",
    description: "Pessoas de contacto associadas aos clientes.",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    path: "/follow-up",
    title: "Follow-up",
    description: "Contactos agendados, tarefas, lembretes e clientes a precisar de seguimento.",
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    path: "/vendas",
    title: "Vendas",
    description: "Compras dos clientes recebidas do sistema de vendas, por associar e em dívida.",
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    path: "/conversas",
    title: "Conversas",
    description: "Mensagens de WhatsApp e SMS com os contactos, com consentimento e janela de 24 horas.",
    changeFrequency: "daily",
    priority: 0.6,
  },
  {
    path: "/cotacoes",
    title: "Cotações",
    description: "Cotações com a tabela de preços do cliente e encomendas até à entrega.",
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    path: "/campanhas",
    title: "Campanhas",
    description: "Campanhas de Email Marketing e SMS.",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    path: "/relatorios",
    title: "Relatórios",
    description: "Desempenho por gestor, zona e equipa, e clientes em risco.",
    changeFrequency: "weekly",
    priority: 0.6,
  },
  {
    path: "/automacoes",
    title: "Automações",
    description: "Regras e sequências de mensagens, tarefas e alertas para os clientes.",
    changeFrequency: "weekly",
    priority: 0.6,
  },
  {
    path: "/auditoria",
    title: "Auditoria",
    description: "Registo de quem alterou o quê nos clientes, contactos, envios e definições.",
    changeFrequency: "daily",
    priority: 0.3,
  },
  {
    path: "/definicoes",
    title: "Definições",
    description: "Dados da empresa, remetentes, modelos de mensagem, equipas, zonas e acessos.",
    changeFrequency: "monthly",
    priority: 0.3,
  },
  {
    path: "/tickets",
    title: "Tickets",
    description: "Pedidos e incidentes de clientes, com cronograma e comentários.",
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    path: "/login",
    title: "Entrar",
    description: "Entrar no CRM da Alimenta Angola.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      locale: "pt_AO",
      type: "website",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: absoluteUrl(image) }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(image)],
    },
  };
}
