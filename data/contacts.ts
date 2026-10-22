export const CONTACTABILITY_STATUSES = [
  "Válido",
  "Inválido",
  "Saiu da empresa",
  "Pediu remoção",
] as const;

export type ContactabilityStatus = (typeof CONTACTABILITY_STATUSES)[number];

export const CONTACTABILITY_TONES: Record<
  ContactabilityStatus,
  "green" | "red" | "amber" | "neutral"
> = {
  Válido: "green",
  Inválido: "red",
  "Saiu da empresa": "amber",
  "Pediu remoção": "neutral",
};

export type ConsentChannel = "email" | "sms" | "whatsapp";

export const CONSENT_CHANNEL_LABELS: Record<ConsentChannel, string> = {
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export type ConsentState = {
  granted: boolean;
  date: string;
  origin: string;
};

export type Contact = {
  id: string;
  name: string;
  role: string;
  companyId: string;
  companyName: string;
  phone: string;
  whatsapp: string;
  email: string;
  preferredLanguage: string;
  contactability: ContactabilityStatus;
  consent: Record<ConsentChannel, ConsentState>;
};

export const CONTACTS: Contact[] = [
  {
    id: "ct-1",
    name: "Fernanda Quitumba",
    role: "Gerente",
    companyId: "boa-esperanca",
    companyName: "Mercearia Boa Esperança",
    phone: "+244 921 334 221",
    whatsapp: "+244 921 334 221",
    email: "fernanda.quitumba@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: true, date: "2026-06-02", origin: "Formulário de registo" },
      sms: { granted: true, date: "2026-06-02", origin: "Formulário de registo" },
      whatsapp: { granted: true, date: "2026-07-15", origin: "Pedido via WhatsApp" },
    },
  },
  {
    id: "ct-2",
    name: "Manuel Cassoma",
    role: "Proprietário",
    companyId: "ilha-cabo",
    companyName: "Restaurante Ilha do Cabo",
    phone: "+244 912 556 783",
    whatsapp: "+244 912 556 783",
    email: "manuel.cassoma@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: true, date: "2026-05-20", origin: "Visita comercial" },
      sms: { granted: false, date: "2026-05-20", origin: "Visita comercial" },
      whatsapp: { granted: true, date: "2026-05-20", origin: "Visita comercial" },
    },
  },
  {
    id: "ct-3",
    name: "Isabel Capinda",
    role: "Diretora de Compras",
    companyId: "baia-azul",
    companyName: "Hotel Baía Azul",
    phone: "+244 999 221 440",
    whatsapp: "+244 999 221 440",
    email: "isabel.capinda@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: true, date: "2026-03-11", origin: "Importação inicial" },
      sms: { granted: true, date: "2026-03-11", origin: "Importação inicial" },
      whatsapp: { granted: false, date: "2026-03-11", origin: "Importação inicial" },
    },
  },
  {
    id: "ct-4",
    name: "Pedro Muanza",
    role: "Gerente de Loja",
    companyId: "nova-vida",
    companyName: "Supermercado Nova Vida",
    phone: "+244 923 118 902",
    whatsapp: "+244 923 118 902",
    email: "pedro.muanza@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Pediu remoção",
    consent: {
      email: { granted: false, date: "2026-08-02", origin: "Pedido de remoção" },
      sms: { granted: false, date: "2026-08-02", origin: "Pedido de remoção" },
      whatsapp: { granted: false, date: "2026-08-02", origin: "Pedido de remoção" },
    },
  },
  {
    id: "ct-5",
    name: "Joana Capemba",
    role: "Proprietária",
    companyId: "tchissola",
    companyName: "Padaria Tchissola",
    phone: "+244 941 772 309",
    whatsapp: "+244 941 772 309",
    email: "joana.capemba@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: true, date: "2026-07-04", origin: "Formulário de registo" },
      sms: { granted: true, date: "2026-07-04", origin: "Formulário de registo" },
      whatsapp: { granted: true, date: "2026-07-04", origin: "Formulário de registo" },
    },
  },
  {
    id: "ct-6",
    name: "Albino Sachipengo",
    role: "Chefe de Compras",
    companyId: "kilamba",
    companyName: "Mercearia Kilamba",
    phone: "+244 912 445 668",
    whatsapp: "+244 912 445 668",
    email: "albino.sachipengo@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: true, date: "2026-04-18", origin: "Visita comercial" },
      sms: { granted: true, date: "2026-04-18", origin: "Visita comercial" },
      whatsapp: { granted: true, date: "2026-06-30", origin: "Pedido via WhatsApp" },
    },
  },
  {
    id: "ct-7",
    name: "Rosa Bumba",
    role: "Gerente Geral",
    companyId: "talatona-plaza",
    companyName: "Hotel Talatona Plaza",
    phone: "+244 999 887 112",
    whatsapp: "+244 999 887 112",
    email: "rosa.bumba@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Inválido",
    consent: {
      email: { granted: false, date: "2026-07-22", origin: "Devolução de e-mail" },
      sms: { granted: true, date: "2026-03-02", origin: "Importação inicial" },
      whatsapp: { granted: false, date: "2026-03-02", origin: "Importação inicial" },
    },
  },
  {
    id: "ct-8",
    name: "Domingos Kiezi",
    role: "Sócio-Gerente",
    companyId: "zango",
    companyName: "Revenda Zango",
    phone: "+244 923 665 390",
    whatsapp: "+244 923 665 390",
    email: "domingos.kiezi@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Saiu da empresa",
    consent: {
      email: { granted: true, date: "2026-02-14", origin: "Importação inicial" },
      sms: { granted: true, date: "2026-02-14", origin: "Importação inicial" },
      whatsapp: { granted: true, date: "2026-02-14", origin: "Importação inicial" },
    },
  },
  {
    id: "ct-9",
    name: "Teresa Mbala",
    role: "Gerente de Loja",
    companyId: "sao-paulo",
    companyName: "Mercearia São Paulo",
    phone: "+244 912 230 774",
    whatsapp: "+244 912 230 774",
    email: "teresa.mbala@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: false, date: "2026-05-29", origin: "Formulário de registo" },
      sms: { granted: true, date: "2026-05-29", origin: "Formulário de registo" },
      whatsapp: { granted: true, date: "2026-05-29", origin: "Formulário de registo" },
    },
  },
  {
    id: "ct-10",
    name: "Agostinho Zola",
    role: "Proprietário",
    companyId: "marisqueira-ilha",
    companyName: "Marisqueira da Ilha",
    phone: "+244 941 556 221",
    whatsapp: "+244 941 556 221",
    email: "agostinho.zola@mail.co.ao",
    preferredLanguage: "Português",
    contactability: "Válido",
    consent: {
      email: { granted: true, date: "2026-08-19", origin: "Visita comercial" },
      sms: { granted: true, date: "2026-08-19", origin: "Visita comercial" },
      whatsapp: { granted: true, date: "2026-08-19", origin: "Visita comercial" },
    },
  },
];
