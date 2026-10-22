"use client";

import { useRef } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import Tag from "@/components/_ui/tag";
import FilterMenu from "@/components/_common/filter-menu";
import VariableMenu from "./variable-menu";
import FallbacksSection from "./fallbacks-section";
import { usePreviewContact } from "./use-preview-contact";
import type { Campaign } from "@/data/campaigns";
import { renderVariables, smsText } from "@/lib/campaigns";
import { formatMoney } from "@/lib/format";
import {
  OPT_OUT_SUFFIX,
  SMS_MESSAGE_UNITS,
  SMS_PRICE,
  analyzeSms,
  isValidSenderId,
  removeAccents,
} from "@/lib/sms";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { cn } from "@/lib/utils";

type SmsContentStepProps = {
  campaign: Campaign;
  readOnly: boolean;
};

function messageLabel(count: number) {
  return count === 1 ? "1 mensagem" : `${count} mensagens`;
}

export default function SmsContentStep({ campaign, readOnly }: SmsContentStepProps) {
  const updateDetails = useCampaignsStore((state) => state.updateDetails);
  const preview = usePreviewContact();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const rendered = renderVariables(smsText(campaign), preview.values, campaign.fallbacks);
  const analysis = analyzeSms(rendered);
  const plainAnalysis = analyzeSms(removeAccents(rendered));
  const hasAccents = analysis.doubleChars.length > 0;
  const senderValid = isValidSenderId(campaign.senderId);
  const windowValid = campaign.sendWindow.start < campaign.sendWindow.end;

  function insertVariable(token: string) {
    const position = bodyRef.current?.selectionStart ?? campaign.smsBody.length;
    updateDetails(campaign.id, {
      smsBody:
        campaign.smsBody.slice(0, position) + token + campaign.smsBody.slice(position),
    });
  }

  return (
    <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="flex min-w-0 flex-col gap-6">
        {readOnly && (
          <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
            {campaign.status === "Em revisão"
              ? "Campanha em revisão — a mensagem está bloqueada. Volte a rascunho em “Revisão e envio” para editar."
              : `Campanha ${campaign.status.toLowerCase()} — só leitura.`}
          </div>
        )}

        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Mensagem</h2>
          <Field
            label="Texto do SMS"
            htmlFor="sms-body"
            required
            error={!readOnly && !campaign.smsBody.trim() ? "A mensagem é obrigatória." : undefined}
            trailing={<VariableMenu onInsert={insertVariable} disabled={readOnly} />}
          >
            <Textarea
              ref={bodyRef}
              id="sms-body"
              rows={5}
              value={campaign.smsBody}
              disabled={readOnly}
              onChange={(event) => updateDetails(campaign.id, { smsBody: event.target.value })}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <Tag tone={analysis.messages > 1 ? "amber" : "green"} size="sm">
              {messageLabel(analysis.messages)}
            </Tag>
            <span className="caption-style text-soft tabular-nums">
              {analysis.units} unidades · {analysis.remaining} livres até à próxima
              mensagem · {formatMoney(analysis.messages * SMS_PRICE)} por destinatário
            </span>
          </div>
          <div className="flex h-1.5 w-full gap-1" aria-hidden>
            {Array.from({ length: Math.max(analysis.messages, 1) }, (_, index) => {
              const used = Math.min(
                Math.max(analysis.units - index * SMS_MESSAGE_UNITS, 0),
                SMS_MESSAGE_UNITS,
              );
              return (
                <span key={index} className="flex-1 overflow-hidden rounded-full bg-white/6">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      analysis.messages > 1 ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${(used / SMS_MESSAGE_UNITS) * 100}%` }}
                  />
                </span>
              );
            })}
          </div>
          <span className="caption-style text-subtle">
            Cada mensagem leva {SMS_MESSAGE_UNITS} unidades. Letras simples contam 1;
            letras com acento e outros caracteres especiais contam 2.
          </span>

          {hasAccents && (
            <div className="flex flex-col gap-3 rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-4 py-3">
              <span className="lead-style text-(--tag-amber-text)">
                Os acentos contam a dobrar
              </span>
              <span className="caption-style text-soft">
                Contam 2 unidades cada:{" "}
                {analysis.doubleChars.map((char) => (
                  <span
                    key={char}
                    className="mx-0.5 rounded bg-white/8 px-1 font-mono text-foreground"
                  >
                    {char}
                  </span>
                ))}
                . Sem eles, esta mensagem teria {plainAnalysis.units} unidades
                {plainAnalysis.messages < analysis.messages
                  ? ` e seria ${messageLabel(plainAnalysis.messages)} em vez de ${analysis.messages} — poupa ${formatMoney((analysis.messages - plainAnalysis.messages) * SMS_PRICE)} por destinatário.`
                  : " (o número de mensagens não muda)."}
              </span>
              {!readOnly && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    updateDetails(campaign.id, { smsBody: removeAccents(campaign.smsBody) })
                  }
                >
                  Substituir acentos
                </Button>
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={campaign.smsOptOut}
              disabled={readOnly}
              onCheckedChange={(checked) =>
                updateDetails(campaign.id, { smsOptOut: checked === true })
              }
            />
            <span className="flex flex-col gap-1">
              <span className="lead-style">Acrescentar instrução de remoção</span>
              <span className="caption-style text-subtle">
                Junta «{OPT_OUT_SUFFIX.trim()}» ao fim da mensagem e entra na
                contagem de caracteres.
              </span>
            </span>
          </label>
        </section>

        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Remetente e janela de envio</h2>
          <Field
            label="Remetente (sender ID)"
            htmlFor="sms-sender"
            required
            error={!senderValid ? "Entre 3 e 11 letras ou números, com pelo menos uma letra." : undefined}
            hint="O remetente alfanumérico tem de estar registado junto das operadoras antes do primeiro envio real."
          >
            <Input
              id="sms-sender"
              value={campaign.senderId}
              disabled={readOnly}
              maxLength={11}
              aria-invalid={!senderValid || undefined}
              className="aria-invalid:border-danger uppercase"
              onChange={(event) =>
                updateDetails(campaign.id, { senderId: event.target.value.toUpperCase() })
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Enviar a partir de" htmlFor="sms-window-start">
              <Input
                id="sms-window-start"
                type="time"
                value={campaign.sendWindow.start}
                disabled={readOnly}
                className="tabular-nums"
                onChange={(event) =>
                  updateDetails(campaign.id, {
                    sendWindow: { ...campaign.sendWindow, start: event.target.value },
                  })
                }
              />
            </Field>
            <Field
              label="Até"
              htmlFor="sms-window-end"
              error={!windowValid ? "O fim tem de ser depois do início." : undefined}
            >
              <Input
                id="sms-window-end"
                type="time"
                value={campaign.sendWindow.end}
                disabled={readOnly}
                className="tabular-nums"
                onChange={(event) =>
                  updateDetails(campaign.id, {
                    sendWindow: { ...campaign.sendWindow, end: event.target.value },
                  })
                }
              />
            </Field>
          </div>
          <span className="caption-style text-subtle">
            Hora de Luanda. Nenhum SMS é agendado fora desta janela.
          </span>
        </section>

        <FallbacksSection campaign={campaign} readOnly={readOnly} />
      </div>

      <section className="border-border flex min-w-0 flex-col gap-4 self-start rounded-xl border p-5 xl:sticky xl:top-5">
        <h2 className="eyebrow-style text-faint font-normal">Pré-visualização</h2>
        <FilterMenu
          label="Ver como"
          value={preview.contactId}
          options={preview.options}
          onChange={preview.setContactId}
          className="self-start"
        />
        <div className="bg-background mx-auto flex w-full max-w-[320px] flex-col gap-3 rounded-[28px] border border-line-strong p-4">
          <div className="flex flex-col items-center gap-1 pb-2 shadow-[inset_0_-1px_0_var(--line-strong)]">
            <span className="bg-muted flex size-9 items-center justify-center rounded-full text-[13px] font-semibold">
              {campaign.senderId.slice(0, 1) || "?"}
            </span>
            <span className="caption-style text-foreground font-medium">
              {campaign.senderId || "Sem remetente"}
            </span>
          </div>
          <span className="caption-style text-subtle text-center">Hoje</span>
          <div className="bg-secondary text-foreground max-w-[90%] self-start rounded-2xl rounded-bl-md px-3 py-2 text-[14px] leading-[1.4] break-words whitespace-pre-line">
            {rendered || "…"}
          </div>
        </div>
        <span className="caption-style text-subtle">
          Este contacto recebe {messageLabel(analysis.messages)} (
          {formatMoney(analysis.messages * SMS_PRICE)}). O custo de todos os
          destinatários aparece em Revisão e envio.
        </span>
      </section>
    </div>
  );
}
