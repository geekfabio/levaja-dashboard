import { API_SCOPES, WEBHOOK_EVENTS, maskSecret, webhookUrlIssue } from "@/lib/leva-ja/trust";
import type { ApiKey, Webhook } from "@/types/leva-ja";
import type { IntegrationsRepository } from "../repositories/integrations";
import { RepositoryError } from "../repositories/errors";
import type { MockDatabase } from "./database";
import { DAY } from "./domain";
import { byNewest, findOr404, requireReason } from "./helpers";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function createMockIntegrations(db: MockDatabase): IntegrationsRepository {
  const token = (length: number) => Array.from({ length }, () => ALPHABET[Math.floor(db.random() * ALPHABET.length)]).join("");
  const knownScopes = new Set(API_SCOPES.map((scope) => scope.key));
  const knownEvents = new Set(WEBHOOK_EVENTS.map((event) => event.key));

  return {
    keys: () => db.run({ permission: "integrations.manage" }, ({ state }) => [...state.apiKeys].sort(byNewest((key) => key.createdAt))),

    createKey: (name, scopes, expiresInDays) =>
      db.run({ permission: "integrations.manage" }, (ctx) => {
        if (name.trim().length < 3) throw new RepositoryError("validation", "Indique o nome da chave.", [{ field: "name", message: "Indique o nome da chave." }]);
        if (scopes.length === 0 || scopes.some((scope) => !knownScopes.has(scope))) throw new RepositoryError("validation", "Escolha pelo menos uma permissão.", [{ field: "scopes", message: "Escolha pelo menos uma permissão." }]);
        if (expiresInDays !== null && ![30, 90, 365].includes(expiresInDays)) throw new RepositoryError("validation", "Escolha uma validade de 30, 90 ou 365 dias.");
        const secret = `lj_live_${token(28)}`;
        const key: ApiKey = {
          id: db.nextId("key"),
          name: name.trim(),
          prefix: secret.slice(0, 12),
          scopes: [...scopes],
          createdAt: ctx.nowIso,
          createdBy: ctx.session.user.name,
          expiresAt: expiresInDays ? new Date(ctx.now.getTime() + expiresInDays * DAY).toISOString() : undefined,
        };
        ctx.state.apiKeys.push(key);
        db.audit(ctx, "integration.key_create", { kind: "integration", id: key.id, label: `${key.name} (${key.prefix}…)` }, `Permissões: ${key.scopes.join(", ")}`);
        db.commit("audit");
        return { item: key, secret };
      }),

    revokeKey: (id, reason) =>
      db.run({ permission: "integrations.manage" }, (ctx) => {
        const key = findOr404(ctx.state.apiKeys, id, "Chave de API");
        if (key.revokedAt) throw new RepositoryError("invalid_transition", "A chave já foi revogada.");
        const why = requireReason(reason, "o motivo");
        key.revokedAt = ctx.nowIso;
        key.revokedBy = ctx.session.user.name;
        key.revokeReason = why;
        db.audit(ctx, "integration.key_revoke", { kind: "integration", id: key.id, label: `${key.name} (${key.prefix}…)` }, why);
        db.commit("audit");
        return key;
      }),

    webhooks: () => db.run({ permission: "integrations.manage" }, ({ state }) => [...state.webhooks].sort(byNewest((webhook) => webhook.createdAt))),

    createWebhook: (input) =>
      db.run({ permission: "integrations.manage" }, (ctx) => {
        const issue = webhookUrlIssue(input.url);
        if (issue) throw new RepositoryError("validation", issue, [{ field: "url", message: issue }]);
        if (input.events.length === 0 || input.events.some((event) => !knownEvents.has(event))) throw new RepositoryError("validation", "Escolha pelo menos um evento.", [{ field: "events", message: "Escolha pelo menos um evento." }]);
        if (ctx.state.webhooks.some((webhook) => webhook.url === input.url.trim())) throw new RepositoryError("validation", "Já existe um webhook para este endereço.", [{ field: "url", message: "Endereço repetido." }]);
        const secret = `whsec_${token(32)}`;
        const webhook: Webhook = {
          id: db.nextId("wh"),
          url: input.url.trim(),
          description: input.description.trim(),
          events: [...input.events],
          active: true,
          secretPreview: maskSecret(secret),
          createdAt: ctx.nowIso,
          createdBy: ctx.session.user.name,
          deliveries: [],
        };
        ctx.state.webhooks.push(webhook);
        db.audit(ctx, "integration.webhook_create", { kind: "integration", id: webhook.id, label: webhook.url }, `Eventos: ${webhook.events.join(", ")}`);
        db.commit("audit");
        return { item: webhook, secret };
      }),

    setWebhookActive: (id, active) =>
      db.run({ permission: "integrations.manage" }, (ctx) => {
        const webhook = findOr404(ctx.state.webhooks, id, "Webhook");
        if (webhook.active === active) throw new RepositoryError("invalid_transition", active ? "O webhook já está activo." : "O webhook já está desactivado.");
        webhook.active = active;
        db.audit(ctx, "integration.webhook_toggle", { kind: "integration", id, label: webhook.url }, undefined, [
          { field: "Estado", from: active ? "Desactivado" : "Activo", to: active ? "Activo" : "Desactivado" },
        ]);
        db.commit("audit");
        return webhook;
      }),

    testWebhook: (id) =>
      db.run({ permission: "integrations.manage" }, (ctx) => {
        const webhook = findOr404(ctx.state.webhooks, id, "Webhook");
        if (!webhook.active) throw new RepositoryError("invalid_transition", "Active o webhook antes de o testar.");
        const delivery = { id: db.nextId("whd"), event: "ping", at: ctx.nowIso, status: 200 as const, durationMs: 80 + Math.floor(db.random() * 300), simulated: true };
        webhook.deliveries = [delivery, ...webhook.deliveries].slice(0, 20);
        db.audit(ctx, "integration.webhook_test", { kind: "integration", id, label: webhook.url }, "Entrega simulada: nenhum pedido HTTP saiu do painel.");
        db.commit("audit");
        return delivery;
      }),
  };
}
