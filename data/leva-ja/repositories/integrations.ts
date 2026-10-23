import type { ApiKey, Webhook, WebhookDelivery } from "@/types/leva-ja";

export type CreatedSecret<T> = { item: T; secret: string };

export type WebhookInput = Pick<Webhook, "url" | "description" | "events">;

export interface IntegrationsRepository {
  keys(): Promise<ApiKey[]>;
  createKey(name: string, scopes: string[], expiresInDays: number | null): Promise<CreatedSecret<ApiKey>>;
  revokeKey(id: string, reason: string): Promise<ApiKey>;
  webhooks(): Promise<Webhook[]>;
  createWebhook(input: WebhookInput): Promise<CreatedSecret<Webhook>>;
  setWebhookActive(id: string, active: boolean): Promise<Webhook>;
  testWebhook(id: string): Promise<WebhookDelivery>;
}
