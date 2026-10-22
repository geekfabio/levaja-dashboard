export type MessageChannel = "SMS" | "E-mail" | "WhatsApp";

export type OutgoingMessage = {
  channel: MessageChannel;
  to: string;
  toName?: string;
  subject?: string;
  body: string;
  companyId?: string;
  contactId?: string;
  source: string;
};

export type SendResult = {
  ok: boolean;
  deliveredTo: string;
  providerId: string;
  error?: string;
};

export type MessagingAdapter = {
  name: string;
  live: boolean;
  send: (message: OutgoingMessage) => SendResult;
};
