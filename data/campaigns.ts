import { DEFAULT_SEND_WINDOW, type SendWindow } from "@/lib/sms";

export type Channel = "Email" | "SMS";

export const CAMPAIGN_STATUSES = [
  "Rascunho",
  "Em revisão",
  "Agendada",
  "Enviada",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  Email: "E-mail",
  SMS: "SMS",
};

export const CHANNEL_TONES: Record<Channel, "blue" | "purple"> = {
  Email: "blue",
  SMS: "purple",
};

export const STATUS_TONES: Record<
  CampaignStatus,
  "neutral" | "blue" | "amber" | "green"
> = {
  Rascunho: "neutral",
  "Em revisão": "blue",
  Agendada: "amber",
  Enviada: "green",
};

export const BRAND_LOGO = "/assets/images/_common/brand/alimenta-angola-logo.png";

export const SANDBOX_ADDRESS = "teste@alimentaangola.co.ao";

export const SANDBOX_PHONE = "+244 900 000 000";

export const DEFAULT_SENDER_ID = "ALIMENTA";

export type BlockType =
  | "heading"
  | "text"
  | "banner"
  | "image"
  | "button"
  | "divider";

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Título",
  text: "Texto",
  banner: "Destaque",
  image: "Imagem",
  button: "Botão",
  divider: "Separador",
};

export type BannerTone = "brand" | "accent";

export const BANNER_TONE_LABELS: Record<BannerTone, string> = {
  brand: "Vermelho",
  accent: "Amarelo",
};

export type CampaignBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | {
      id: string;
      type: "banner";
      title: string;
      subtitle: string;
      tone: BannerTone;
    }
  | { id: string; type: "image"; src: string; alt: string }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "divider" };

export type BlockDraft = CampaignBlock extends infer Block
  ? Block extends CampaignBlock
    ? Omit<Block, "id">
    : never
  : never;

export const VARIABLES = [
  { key: "nome", label: "Nome do contacto", fallback: "Cliente" },
  { key: "empresa", label: "Empresa", fallback: "a sua empresa" },
  { key: "gestor", label: "Gestor de conta", fallback: "a equipa comercial" },
  { key: "zona", label: "Zona", fallback: "Luanda" },
  { key: "saldo", label: "Saldo em conta", fallback: "consulte o seu gestor" },
] as const;

export type VariableKey = (typeof VARIABLES)[number]["key"];

export type Fallbacks = Record<VariableKey, string>;

export const DEFAULT_FALLBACKS = Object.fromEntries(
  VARIABLES.map((variable) => [variable.key, variable.fallback]),
) as Fallbacks;

export const ANY = "all";

export const ABC_CLASSES = ["A", "B", "C"] as const;

export type AbcClass = (typeof ABC_CLASSES)[number];

export type AudienceFilters = {
  zone: string;
  segment: string;
  abc: string;
  inactiveDays: string;
};

export const DEFAULT_AUDIENCE: AudienceFilters = {
  zone: ANY,
  segment: ANY,
  abc: ANY,
  inactiveDays: ANY,
};

export type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  subject: string;
  preheader: string;
  blocks: BlockDraft[];
};

export const TEMPLATES: CampaignTemplate[] = [
  {
    id: "promocao-semanal",
    name: "Promoção semanal",
    description: "Destaque de preços da semana em mercearia e bebidas.",
    subject: "{{nome}}, as promoções desta semana já chegaram",
    preheader: "Até 15% de desconto em mercearia e bebidas.",
    blocks: [
      {
        type: "banner",
        title: "Promoção da semana",
        subtitle: "Até -15% em mercearia e bebidas",
        tone: "accent",
      },
      { type: "heading", text: "Olá, {{nome}}" },
      {
        type: "text",
        text: "Esta semana preparámos condições especiais para {{empresa}}. Os preços são válidos até domingo ou enquanto houver stock no armazém.",
      },
      { type: "button", label: "Ver promoções", href: "https://alimentaangola.co.ao/promocoes" },
      {
        type: "text",
        text: "Qualquer dúvida, fale com {{gestor}}.",
      },
    ],
  },
  {
    id: "lista-precos",
    name: "Lista de preços",
    description: "Envio mensal da tabela de preços atualizada.",
    subject: "Nova lista de preços para {{empresa}}",
    preheader: "Preços atualizados para o próximo mês.",
    blocks: [
      {
        type: "banner",
        title: "Nova lista de preços",
        subtitle: "Válida a partir do próximo mês",
        tone: "accent",
      },
      { type: "heading", text: "Olá, {{nome}}" },
      {
        type: "text",
        text: "A nova tabela de preços para {{empresa}} já está disponível.\nSaldo atual da sua conta: {{saldo}}.",
      },
      { type: "button", label: "Consultar lista de preços", href: "https://alimentaangola.co.ao/precos" },
    ],
  },
  {
    id: "novo-produto",
    name: "Novo produto",
    description: "Anúncio de uma referência nova no catálogo.",
    subject: "Novidade no catálogo Alimenta Angola",
    preheader: "Uma nova referência já disponível no armazém.",
    blocks: [
      {
        type: "banner",
        title: "Novidade",
        subtitle: "Massas importadas já disponíveis",
        tone: "brand",
      },
      {
        type: "text",
        text: "{{nome}}, acabámos de receber uma nova gama de massas importadas, com entrega em {{zona}} a partir desta semana.",
      },
      { type: "button", label: "Encomendar", href: "https://alimentaangola.co.ao/novidades" },
    ],
  },
  {
    id: "aviso-rutura",
    name: "Aviso de rutura",
    description: "Comunicação de falta de stock e alternativas.",
    subject: "Aviso: rutura temporária de stock",
    preheader: "Alternativas disponíveis até à reposição.",
    blocks: [
      {
        type: "banner",
        title: "Aviso de rutura",
        subtitle: "Óleo alimentar 5 L temporariamente indisponível",
        tone: "brand",
      },
      {
        type: "text",
        text: "Informamos que o óleo alimentar de 5 L está sem stock em {{zona}}. Prevemos a reposição na próxima semana.",
      },
      { type: "divider" },
      {
        type: "text",
        text: "Até lá, {{gestor}} pode propor alternativas equivalentes para {{empresa}}.",
      },
      { type: "button", label: "Falar com o gestor", href: "https://alimentaangola.co.ao/contacto" },
    ],
  },
  {
    id: "boas-vindas",
    name: "Boas-vindas",
    description: "Primeiro contacto com um cliente novo.",
    subject: "Bem-vindo à Alimenta Angola, {{nome}}",
    preheader: "Conheça o catálogo e o seu gestor de conta.",
    blocks: [
      {
        type: "banner",
        title: "Bem-vindo!",
        subtitle: "Preços de grossista para o seu negócio",
        tone: "brand",
      },
      { type: "heading", text: "Olá, {{nome}}" },
      {
        type: "text",
        text: "Obrigado por escolher a Alimenta Angola. A partir de hoje, {{empresa}} conta com preços de grossista e entregas em {{zona}}.",
      },
      { type: "button", label: "Conhecer o catálogo", href: "https://alimentaangola.co.ao/catalogo" },
      { type: "divider" },
      {
        type: "text",
        text: "Qualquer dúvida, fale com {{gestor}}.",
      },
    ],
  },
  {
    id: "aniversario",
    name: "Aniversário do cliente",
    description: "Celebração do aniversário da relação comercial.",
    subject: "{{nome}}, parabéns por mais um ano connosco",
    preheader: "Uma oferta especial para celebrar consigo.",
    blocks: [
      {
        type: "banner",
        title: "Parabéns!",
        subtitle: "Mais um ano a crescer juntos",
        tone: "accent",
      },
      {
        type: "text",
        text: "{{nome}}, obrigado por mais um ano de confiança. Para celebrar, a próxima encomenda tem uma oferta especial.",
      },
      { type: "button", label: "Ver oferta", href: "https://alimentaangola.co.ao/oferta" },
    ],
  },
];

export const BLANK_TEMPLATE: CampaignTemplate = {
  id: "em-branco",
  name: "Em branco",
  description: "Começar só com um título e um texto.",
  subject: "",
  preheader: "",
  blocks: [
    { type: "heading", text: "Olá, {{nome}}" },
    { type: "text", text: "" },
  ],
};

export type SmsTemplate = {
  id: string;
  name: string;
  description: string;
  body: string;
};

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: "sms-promocao",
    name: "Promoção relâmpago",
    description: "Desconto curto, válido poucos dias.",
    body: "Alimenta Angola: {{nome}}, -15% em óleo e arroz esta semana em {{zona}}.",
  },
  {
    id: "sms-desconto",
    name: "Desconto de reativação",
    description: "Proposta de desconto a clientes sem compras.",
    body: "Alimenta Angola: {{nome}}, tem {{desconto}} de desconto na próxima compra até {{validade}}. Esperamos por si!",
  },
  {
    id: "sms-entrega",
    name: "Aviso de entrega",
    description: "Encomenda a caminho do cliente.",
    body: "Alimenta Angola: {{nome}}, a sua encomenda sai hoje para {{zona}}. Obrigado!",
  },
  {
    id: "sms-pagamento",
    name: "Lembrete de pagamento",
    description: "Fatura a vencer, com o saldo em conta.",
    body: "Alimenta Angola: {{nome}}, a sua fatura vence esta semana. Saldo: {{saldo}}.",
  },
  {
    id: "sms-rutura",
    name: "Aviso de rutura",
    description: "Produto sem stock e prazo de reposição.",
    body: "Alimenta Angola: óleo 5 L sem stock em {{zona}} até dia 20. Fale com {{gestor}}.",
  },
];

export const BLANK_SMS_TEMPLATE: SmsTemplate = {
  id: "sms-em-branco",
  name: "Em branco",
  description: "Começar com uma mensagem vazia.",
  body: "Alimenta Angola: ",
};

export type CampaignLink = {
  label: string;
  clicks: number;
};

export type CampaignMetrics = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  hardBounces: number;
  softBounces: number;
  unsubscribed: number;
  links: CampaignLink[];
};

export type Campaign = {
  id: string;
  name: string;
  channel: Channel;
  status: CampaignStatus;
  templateId?: string;
  subject: string;
  preheader: string;
  blocks: CampaignBlock[];
  smsBody: string;
  senderId: string;
  smsOptOut: boolean;
  sendWindow: SendWindow;
  fallbacks: Fallbacks;
  audience: AudienceFilters;
  testSentAt?: string;
  scheduledAt?: string;
  sentAt?: string;
  recipients: number;
  metrics?: CampaignMetrics;
  updatedAt: string;
};

export const SMS_DEFAULTS = {
  smsBody: "",
  senderId: DEFAULT_SENDER_ID,
  smsOptOut: true,
  sendWindow: DEFAULT_SEND_WINDOW,
} satisfies Partial<Campaign>;

export const EMAIL_DEFAULTS = {
  subject: "",
  preheader: "",
  blocks: [],
} satisfies Partial<Campaign>;

export function blocksFromTemplate(
  template: CampaignTemplate,
  prefix: string,
): CampaignBlock[] {
  return template.blocks.map(
    (block, index) => ({ ...block, id: `${prefix}-${index}` }) as CampaignBlock,
  );
}

function templateById(id: string) {
  return TEMPLATES.find((template) => template.id === id)!;
}

function seeded(
  id: string,
  templateId: string,
  rest: Omit<
    Campaign,
    | "id"
    | "templateId"
    | "subject"
    | "preheader"
    | "blocks"
    | "fallbacks"
    | keyof typeof SMS_DEFAULTS
  >,
): Campaign {
  const template = templateById(templateId);
  return {
    id,
    templateId,
    subject: template.subject,
    preheader: template.preheader,
    blocks: blocksFromTemplate(template, id),
    ...SMS_DEFAULTS,
    fallbacks: { ...DEFAULT_FALLBACKS },
    ...rest,
  };
}

function seededSms(
  id: string,
  templateId: string,
  rest: Omit<
    Campaign,
    | "id"
    | "templateId"
    | "smsBody"
    | "senderId"
    | "smsOptOut"
    | "sendWindow"
    | "fallbacks"
    | keyof typeof EMAIL_DEFAULTS
  >,
): Campaign {
  const template = SMS_TEMPLATES.find((item) => item.id === templateId)!;
  return {
    id,
    templateId,
    ...EMAIL_DEFAULTS,
    ...SMS_DEFAULTS,
    smsBody: template.body,
    fallbacks: { ...DEFAULT_FALLBACKS },
    ...rest,
  };
}

export const CAMPAIGNS: Campaign[] = [
  seeded("cmp-1", "promocao-semanal", {
    name: "Promoção semanal — mercearia",
    channel: "Email",
    status: "Enviada",
    audience: { ...DEFAULT_AUDIENCE, segment: "Grossista" },
    testSentAt: "2026-09-28T17:05",
    sentAt: "2026-09-29T09:00",
    recipients: 486,
    metrics: {
      sent: 486,
      delivered: 471,
      opened: 198,
      clicked: 61,
      hardBounces: 9,
      softBounces: 6,
      unsubscribed: 3,
      links: [
        { label: "Ver promoções", clicks: 52 },
        { label: "Logótipo (cabeçalho)", clicks: 9 },
      ],
    },
    updatedAt: "2026-09-29",
  }),
  seeded("cmp-2", "lista-precos", {
    name: "Lista de preços — outubro",
    channel: "Email",
    status: "Enviada",
    audience: { ...DEFAULT_AUDIENCE },
    testSentAt: "2026-09-30T15:40",
    sentAt: "2026-10-01T08:30",
    recipients: 512,
    metrics: {
      sent: 512,
      delivered: 497,
      opened: 189,
      clicked: 44,
      hardBounces: 11,
      softBounces: 4,
      unsubscribed: 2,
      links: [
        { label: "Consultar lista de preços", clicks: 41 },
        { label: "Logótipo (cabeçalho)", clicks: 3 },
      ],
    },
    updatedAt: "2026-10-01",
  }),
  seededSms("cmp-3", "sms-rutura", {
    name: "Aviso de rutura — óleo alimentar",
    channel: "SMS",
    status: "Enviada",
    audience: { ...DEFAULT_AUDIENCE },
    testSentAt: "2026-10-02T16:10",
    sentAt: "2026-10-03T10:00",
    recipients: 310,
    metrics: {
      sent: 310,
      delivered: 297,
      opened: 0,
      clicked: 0,
      hardBounces: 8,
      softBounces: 5,
      unsubscribed: 1,
      links: [],
    },
    updatedAt: "2026-10-03",
  }),
  seeded("cmp-4", "boas-vindas", {
    name: "Boas-vindas — novos clientes HORECA",
    channel: "Email",
    status: "Agendada",
    audience: { ...DEFAULT_AUDIENCE, segment: "HORECA" },
    testSentAt: "2026-10-08T16:20",
    scheduledAt: "2026-10-14T09:00",
    recipients: 64,
    updatedAt: "2026-10-08",
  }),
  seededSms("cmp-5", "sms-pagamento", {
    name: "Lembrete de pagamento — contas em atraso",
    channel: "SMS",
    status: "Agendada",
    audience: { ...DEFAULT_AUDIENCE, inactiveDays: "60" },
    testSentAt: "2026-10-07T11:30",
    scheduledAt: "2026-10-12T10:00",
    recipients: 128,
    updatedAt: "2026-10-07",
  }),
  seeded("cmp-6", "novo-produto", {
    name: "Novo produto — massas importadas",
    channel: "Email",
    status: "Rascunho",
    audience: { ...DEFAULT_AUDIENCE, zone: "Luanda" },
    recipients: 0,
    updatedAt: "2026-10-09",
  }),
];
