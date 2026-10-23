"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { mutationError } from "@/hooks/admin/use-admin-mutation";
import { useSetWebhookActive, useTestWebhook, useWebhooks } from "@/hooks/admin/use-trust";
import { formatDateTimeNumeric, formatNumber } from "@/lib/format";
import { WEBHOOK_EVENTS } from "@/lib/leva-ja/trust";
import type { Webhook, WebhookDelivery } from "@/types/leva-ja";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import CreateWebhookDialog from "../dialogs/create-webhook-dialog";
import SecretDialog from "../dialogs/secret-dialog";

const EVENT_LABELS = Object.fromEntries(WEBHOOK_EVENTS.map((event) => [event.key, event.label]));

function deliveryLabel(delivery: WebhookDelivery) {
  if (delivery.status === "timeout") return "Sem resposta";
  return `HTTP ${delivery.status}`;
}

function WebhookCard({ webhook }: { webhook: Webhook }) {
  const toggle = useSetWebhookActive();
  const test = useTestWebhook();
  const recent = webhook.deliveries.slice(0, 5);
  const failed = webhook.deliveries.filter((delivery) => delivery.status !== 200).length;
  const error = mutationError(toggle.error) ?? mutationError(test.error);

  return (
    <li className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="lead-style font-mono text-[13px] break-all">{webhook.url}</span>
          {webhook.description ? <span className="caption-style text-soft">{webhook.description}</span> : null}
        </span>
        <ToneBadge tone={webhook.active ? "success" : "neutral"} label={webhook.active ? "Activo" : "Desactivado"} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {webhook.events.map((event) => (
          <span key={event} className="caption-style bg-muted text-soft rounded-md px-2 py-0.5">
            {EVENT_LABELS[event] ?? event}
          </span>
        ))}
      </div>
      <dl className="caption-style text-subtle flex flex-wrap gap-x-5 gap-y-1">
        <div className="flex gap-1">
          <dt>Segredo:</dt>
          <dd className="text-soft font-mono">{webhook.secretPreview}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Criado:</dt>
          <dd className="text-soft">
            {webhook.createdBy} · {formatDateTimeNumeric(webhook.createdAt)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Falhas:</dt>
          <dd className="text-soft tabular-nums">
            {formatNumber(failed)} de {formatNumber(webhook.deliveries.length)}
          </dd>
        </div>
      </dl>
      <section aria-label={`Envios recentes para ${webhook.url}`} className="flex flex-col gap-1">
        <h3 className="eyebrow-style text-faint font-normal">Envios recentes</h3>
        {recent.length === 0 ? (
          <p className="caption-style text-subtle">Ainda sem envios.</p>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {recent.map((delivery) => (
              <li key={delivery.id} className="caption-style flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-soft">
                  {delivery.event === "ping" ? "Teste" : (EVENT_LABELS[delivery.event] ?? delivery.event)}
                  {delivery.simulated ? <span className="text-subtle"> · simulado</span> : null}
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="text-subtle">{formatDateTimeNumeric(delivery.at)}</span>
                  <span className="text-subtle">{formatNumber(delivery.durationMs)} ms</span>
                  <ToneBadge tone={delivery.status === 200 ? "success" : "danger"} label={deliveryLabel(delivery)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error ? (
          <span role="alert" className="caption-style text-danger mr-auto">
            {error}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: webhook.id, active: !webhook.active })}>
          {webhook.active ? "Desactivar" : "Activar"}
        </Button>
        <Button variant="secondary" size="sm" disabled={test.isPending || !webhook.active} onClick={() => test.mutate(webhook.id)}>
          {test.isPending ? "A testar…" : "Enviar teste simulado"}
        </Button>
      </div>
    </li>
  );
}

export default function WebhooksPanel() {
  const query = useWebhooks();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <section aria-labelledby="webhooks-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="webhooks-title" className="eyebrow-style text-faint font-normal">
            Webhooks
          </h2>
          <p className="caption-style text-subtle max-w-[60em]">Em demonstração, os testes não fazem pedidos reais: o resultado é simulado e fica marcado como tal.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <PlusIcon aria-hidden className="size-3" />
          Novo webhook
        </Button>
      </div>
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-48 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(items) => items.length === 0}
        empty={{
          title: "Sem webhooks",
          description: "Ainda não foi registado nenhum endereço.",
        }}
      >
        {(webhooks) => (
          <ul className="grid gap-3 xl:grid-cols-2">
            {webhooks.map((webhook) => (
              <WebhookCard key={webhook.id} webhook={webhook} />
            ))}
          </ul>
        )}
      </AsyncState>
      <CreateWebhookDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(value) => {
          setCreating(false);
          setSecret(value);
        }}
      />
      <SecretDialog title="Webhook criado" label="Segredo de assinatura" secret={secret} onClose={() => setSecret(null)} />
    </section>
  );
}
