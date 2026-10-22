"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import Tag from "@/components/_ui/tag";
import { SANDBOX_ADDRESS, SANDBOX_PHONE, type Campaign } from "@/data/campaigns";
import {
  EXCLUSION_TONES,
  campaignRates,
  canSubmitForReview,
  estimateSmsCost,
  reviewChecks,
  smsText,
  type Audience,
  type ExclusionReason,
} from "@/lib/campaigns";
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercentDecimal,
  luandaLocalToDate,
} from "@/lib/format";
import { SMS_MESSAGE_UNITS, SMS_PRICE, analyzeSms, isWithinWindow } from "@/lib/sms";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useMessagingStore } from "@/stores/messaging-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function isPast(local: string) {
  return luandaLocalToDate(local).getTime() <= Date.now();
}

type ReviewStepProps = {
  campaign: Campaign;
  audience: Audience;
};

export default function ReviewStep({ campaign, audience }: ReviewStepProps) {
  const submitForReview = useCampaignsStore((state) => state.submitForReview);
  const backToDraft = useCampaignsStore((state) => state.backToDraft);
  const recordTest = useCampaignsStore((state) => state.recordTest);
  const schedule = useCampaignsStore((state) => state.schedule);
  const cancelSchedule = useCampaignsStore((state) => state.cancelSchedule);
  const balance = useMessagingStore((state) => state.balance);
  const reservations = useMessagingStore((state) => state.reservations);
  const router = useRouter();
  const reservedElsewhere = Object.entries(reservations)
    .filter(([campaignId]) => campaignId !== campaign.id)
    .reduce((sum, [, value]) => sum + value, 0);
  const availableCredit = balance - reservedElsewhere;
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const isSms = campaign.channel === "SMS";
  const testTarget = isSms ? SANDBOX_PHONE : SANDBOX_ADDRESS;
  const windowLabel = `${campaign.sendWindow.start}–${campaign.sendWindow.end}`;
  const checks = reviewChecks(campaign, audience.eligible.length);
  const cost = isSms
    ? estimateSmsCost(audience.eligible, smsText(campaign), campaign.fallbacks)
    : null;
  const exclusions = Object.entries(audience.exclusionCounts) as [
    ExclusionReason,
    number,
  ][];

  function handleSchedule() {
    if (!scheduledAt) {
      setScheduleError("Escolha a data e a hora de envio.");
      return;
    }
    if (isPast(scheduledAt)) {
      setScheduleError("A data de envio tem de estar no futuro.");
      return;
    }
    if (isSms && !isWithinWindow(scheduledAt, campaign.sendWindow)) {
      setScheduleError(
        `Fora da janela de envio (${windowLabel}, hora de Luanda). Escolha outra hora.`,
      );
      return;
    }
    if (isSms && cost && cost.cost > availableCredit) {
      setScheduleError(
        `Saldo de SMS insuficiente: a campanha custa ${formatMoney(cost.cost)} e há ${formatMoney(Math.max(0, availableCredit))} disponíveis. Faltam ${formatMoney(cost.cost - availableCredit)}.`,
      );
      return;
    }
    setScheduleError(null);
    schedule(campaign.id, scheduledAt, audience.eligible.length, cost?.cost);
  }

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Verificação</h2>
          <ul className="flex flex-col gap-3">
            {checks.map((check) => (
              <li key={check.key} className="flex items-center justify-between gap-3">
                <span className={cn("lead-style", !check.ok && "text-soft")}>
                  {check.label}
                </span>
                <Tag tone={check.ok ? "green" : "neutral"} size="sm">
                  {check.ok ? "Feito" : "Em falta"}
                </Tag>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Destinatários</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-semibold tabular-nums">
              {formatNumber(
                campaign.status === "Agendada" || campaign.status === "Enviada"
                  ? campaign.recipients
                  : audience.eligible.length,
              )}
            </span>
            <span className="caption-style text-subtle">destinatários elegíveis</span>
          </div>
          {exclusions.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-4 py-3">
              <span className="lead-style text-(--tag-amber-text)">
                {audience.excluded.length}{" "}
                {audience.excluded.length === 1
                  ? "contacto será excluído"
                  : "contactos serão excluídos"}{" "}
                automaticamente
              </span>
              <div className="flex flex-wrap gap-1.5">
                {exclusions.map(([reason, count]) => (
                  <Tag key={reason} tone={EXCLUSION_TONES[reason]} size="sm">
                    {reason} · {count}
                  </Tag>
                ))}
              </div>
            </div>
          ) : (
            <span className="caption-style text-subtle">
              Nenhum contacto excluído neste segmento.
            </span>
          )}
        </section>

        {cost && campaign.status !== "Enviada" && (
          <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
            <h2 className="eyebrow-style text-faint font-normal">Custo estimado</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] leading-none font-semibold tabular-nums">
                {formatMoney(cost.cost)}
              </span>
              <span className="caption-style text-subtle">
                {formatNumber(cost.messages)} mensagens a {formatMoney(SMS_PRICE)}
              </span>
            </div>
            {cost.byOperator.length > 0 && (
              <ul className="divide-border flex flex-col divide-y">
                {cost.byOperator.map((item) => (
                  <li
                    key={item.operator}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="lead-style">{item.operator}</span>
                      <span className="caption-style text-subtle tabular-nums">
                        {formatNumber(item.recipients)} destinatários ·{" "}
                        {formatNumber(item.messages)} mensagens
                      </span>
                    </span>
                    <span className="lead-style tabular-nums">{formatMoney(item.cost)}</span>
                  </li>
                ))}
              </ul>
            )}
            {cost.cost > cost.plainCost && (
              <span className="caption-style rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-3 py-2 text-(--tag-amber-text)">
                Os acentos acrescentam {formatMoney(cost.cost - cost.plainCost)} a esta
                campanha ({cost.accentRecipients} de {audience.eligible.length}{" "}
                destinatários recebem texto com acentos).
                {analyzeSms(smsText(campaign)).doubleChars.length === 0 &&
                  " O texto não tem acentos — vêm dos valores das variáveis, como nomes de gestores com ã ou ç."}
              </span>
            )}
            <div
              className={cn(
                "caption-style flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                cost.cost > availableCredit
                  ? "border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text)"
                  : "border-line-strong text-soft",
              )}
            >
              <span>
                Saldo disponível {formatMoney(Math.max(0, availableCredit))}
                {reservedElsewhere > 0 && ` (já descontadas ${formatMoney(reservedElsewhere)} reservadas para outras campanhas)`}
                {cost.cost > availableCredit && ` — faltam ${formatMoney(cost.cost - availableCredit)}`}.
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  useSettingsStore.getState().setTab("mensagens");
                  router.push("/definicoes");
                }}
              >
                Carregar saldo
              </Button>
            </div>
            <span className="caption-style text-subtle">
              Calculado por destinatário, com as variáveis já preenchidas: cada{" "}
              {SMS_MESSAGE_UNITS} unidades contam como uma mensagem e as letras com
              acento contam 2. Pacote único a {formatMoney(SMS_PRICE)} por mensagem,
              igual para todas as operadoras.
            </span>
          </section>
        )}
      </div>

      <section className="border-border flex min-w-0 flex-col gap-4 self-start rounded-xl border p-5">
        <h2 className="eyebrow-style text-faint font-normal">Envio</h2>

        <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
          Modo sandbox: {isSms ? "nenhum SMS" : "nenhum e-mail"} sai deste ecrã. O
          envio real depende {isSms ? "do agregador de SMS" : "do fornecedor de e-mail"}{" "}
          e de <span className="font-mono">MESSAGING_LIVE=true</span> (ver ROADMAP,
          Fase {isSms ? "5" : "4"}).
        </div>

        {campaign.status === "Rascunho" && (
          <div className="flex flex-col gap-3">
            <span className="caption-style text-subtle">
              Submeta para revisão quando o conteúdo e o segmento estiverem
              prontos. Em revisão, o conteúdo fica bloqueado.
            </span>
            <Button
              variant="primary"
              size="sm"
              className="self-start"
              disabled={!canSubmitForReview(checks)}
              onClick={() => submitForReview(campaign.id)}
            >
              Submeter para revisão
            </Button>
          </div>
        )}

        {campaign.status === "Em revisão" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="lead-style">1. Envio de teste</span>
              {campaign.testSentAt ? (
                <span className="caption-style text-subtle">
                  Teste registado a {formatDateTime(campaign.testSentAt)} para{" "}
                  {testTarget} — em sandbox, nada foi entregue.
                </span>
              ) : (
                <span className="caption-style text-subtle">
                  Obrigatório antes de agendar. Fica registado em sandbox para{" "}
                  {testTarget}.
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => recordTest(campaign.id)}
              >
                {campaign.testSentAt ? "Repetir teste" : "Registar envio de teste"}
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              <span className="lead-style">2. Agendamento</span>
              <Field
                label="Data e hora (Luanda)"
                htmlFor="campaign-schedule"
                error={scheduleError ?? undefined}
                hint={isSms ? `Janela de envio: ${windowLabel}.` : undefined}
              >
                <Input
                  id="campaign-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  disabled={!campaign.testSentAt}
                  onChange={(event) => {
                    setScheduledAt(event.target.value);
                    if (scheduleError) setScheduleError(null);
                  }}
                  className="tabular-nums"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!campaign.testSentAt || audience.eligible.length === 0}
                  onClick={handleSchedule}
                >
                  Agendar campanha
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => backToDraft(campaign.id)}
                >
                  Voltar a rascunho
                </Button>
              </div>
            </div>
          </div>
        )}

        {campaign.status === "Agendada" && campaign.scheduledAt && (
          <div className="flex flex-col gap-3">
            <span className="lead-style">
              Agendada para {formatDateTime(campaign.scheduledAt)}
            </span>
            <span className="caption-style text-subtle">
              {formatNumber(campaign.recipients)} destinatários fixados no
              momento do agendamento.
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => cancelSchedule(campaign.id)}
            >
              Cancelar agendamento
            </Button>
          </div>
        )}

        {campaign.status === "Enviada" && (
          <div className="flex flex-col gap-2">
            <span className="lead-style">
              Enviada a {formatNumber(campaign.recipients)} destinatários
            </span>
            {campaign.metrics && (
              <span className="caption-style text-subtle">
                Taxa de entrega:{" "}
                {formatPercentDecimal(campaignRates(campaign.metrics).delivered)}
                {!isSms &&
                  ` · Taxa de abertura: ${formatPercentDecimal(campaignRates(campaign.metrics).opened)}`}
                . Detalhe no separador Resultados.
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
