export type ConversationChannel = "WhatsApp" | "SMS";

export type MessageDirection = "in" | "out" | "system";

export type ConversationMessage = {
  id: string;
  direction: MessageDirection;
  body: string;
  at: string;
  author?: string;
  status?: "Simulado" | "Bloqueado";
};

export type Conversation = {
  id: string;
  contactId: string;
  channel: ConversationChannel;
  messages: ConversationMessage[];
  unread: number;
};

export const WHATSAPP_WINDOW_HOURS = 24;

export const OPT_OUT_KEYWORDS = ["PARAR", "STOP", "SAIR"];

export const INCOMING_SAMPLES = [
  "Bom dia, ainda têm arroz agulha de 25 kg?",
  "Podem entregar amanhã de manhã?",
  "Qual é o preço do óleo de 20 L esta semana?",
  "Recebemos a encomenda, obrigado!",
  "Preciso da fatura da última compra, por favor.",
  "Faltaram duas caixas de sumo na entrega.",
  "PARAR",
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "cv-1",
    contactId: "ct-1",
    channel: "WhatsApp",
    unread: 2,
    messages: [
      { id: "m1", direction: "out", body: "Bom dia Fernanda, a sua encomenda de açúcar já saiu do armazém.", at: "2026-10-12T09:10", author: "Sara Neto", status: "Simulado" },
      { id: "m2", direction: "in", body: "Obrigada! Qual é o preço do óleo de 20 L esta semana?", at: "2026-10-12T17:35" },
      { id: "m3", direction: "in", body: "Se for bom, levo 20 bidões.", at: "2026-10-12T17:36" },
    ],
  },
  {
    id: "cv-2",
    contactId: "ct-2",
    channel: "WhatsApp",
    unread: 0,
    messages: [
      { id: "m1", direction: "in", body: "Boa tarde, podem mandar a tabela de bebidas?", at: "2026-10-09T15:02" },
      { id: "m2", direction: "out", body: "Boa tarde Manuel, envio já a tabela atualizada.", at: "2026-10-09T15:20", author: "Jaime Teixeira", status: "Simulado" },
    ],
  },
  {
    id: "cv-3",
    contactId: "ct-9",
    channel: "SMS",
    unread: 1,
    messages: [
      { id: "m1", direction: "out", body: "Alimenta Angola: a sua cotação de leite está pronta. Responda SIM para confirmar.", at: "2026-10-11T10:00", author: "Sara Neto", status: "Simulado" },
      { id: "m2", direction: "in", body: "Obrigada, passo amanhã na loja.", at: "2026-10-11T12:41" },
    ],
  },
  {
    id: "cv-4",
    contactId: "ct-6",
    channel: "WhatsApp",
    unread: 0,
    messages: [
      { id: "m1", direction: "in", body: "A entrega chegou completa, obrigado.", at: "2026-10-10T11:15" },
    ],
  },
];
