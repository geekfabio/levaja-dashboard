"use client";

import { useState, type FormEvent } from "react";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import SettingsPanel from "../settings-panel";
import SaveBar from "../save-bar";
import { SANDBOX_ADDRESS, SANDBOX_PHONE } from "@/data/campaigns";
import { COMPANY_EMAIL_DOMAIN, type SenderSettings } from "@/data/settings";
import { emailSender, isCompanyEmail, isEmail } from "@/lib/settings";
import { isValidSenderId } from "@/lib/sms";
import { useSettingsStore } from "@/stores/settings-store";

function senderErrors(senders: SenderSettings) {
  const errors: Partial<Record<keyof SenderSettings, string>> = {};
  if (!senders.emailName.trim()) errors.emailName = "Indique o nome do remetente.";
  if (!isCompanyEmail(senders.emailAddress)) {
    errors.emailAddress = `Tem de ser um endereço @${COMPANY_EMAIL_DOMAIN}.`;
  }
  if (!isEmail(senders.replyTo)) errors.replyTo = "E-mail inválido.";
  if (!isValidSenderId(senders.smsSenderId)) {
    errors.smsSenderId = "3 a 11 caracteres, só letras sem acento, números e espaços.";
  }
  if (senders.windowStart >= senders.windowEnd) {
    errors.windowEnd = "O fim tem de ser depois do início.";
  }
  return errors;
}

export default function SendersTab() {
  const senders = useSettingsStore((state) => state.senders);
  const saveSenders = useSettingsStore((state) => state.saveSenders);
  const [draft, setDraft] = useState(senders);
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const errors = senderErrors(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(senders);

  function update<K extends keyof SenderSettings>(key: K, value: SenderSettings[K]) {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function errorFor(key: keyof SenderSettings) {
    return submitted ? errors[key] : undefined;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    saveSenders({
      ...draft,
      emailAddress: draft.emailAddress.trim().toLowerCase(),
      replyTo: draft.replyTo.trim().toLowerCase(),
      smsSenderId: draft.smsSenderId.trim().toUpperCase(),
    });
    setSaved(true);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 p-5">
      <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
        Em desenvolvimento todas as mensagens seguem para a caixa de teste ({SANDBOX_ADDRESS}) e
        para o número de teste ({SANDBOX_PHONE}). O envio real exige a ativação do modo real no
        servidor — não é possível ligá-lo a partir daqui.
      </div>

      <SettingsPanel
        title="E-mail"
        description="Remetente por omissão das campanhas e automações de e-mail."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do remetente" htmlFor="sender-name" required error={errorFor("emailName")}>
            <Input
              id="sender-name"
              value={draft.emailName}
              onChange={(event) => update("emailName", event.target.value)}
            />
          </Field>
          <Field
            label="Endereço de envio"
            htmlFor="sender-address"
            required
            hint={`Só endereços do domínio ${COMPANY_EMAIL_DOMAIN}, verificado no fornecedor.`}
            error={errorFor("emailAddress")}
          >
            <Input
              id="sender-address"
              type="email"
              inputMode="email"
              value={draft.emailAddress}
              onChange={(event) => update("emailAddress", event.target.value)}
            />
          </Field>
          <Field
            label="Responder para"
            htmlFor="sender-reply"
            required
            hint="As respostas dos clientes chegam a este endereço."
            error={errorFor("replyTo")}
          >
            <Input
              id="sender-reply"
              type="email"
              inputMode="email"
              value={draft.replyTo}
              onChange={(event) => update("replyTo", event.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="caption-style text-subtle">Pré-visualização</span>
            <span className="lead-style rounded-lg border border-line-strong bg-white/3 px-3 py-2.5 break-all">
              De: {emailSender(draft)}
            </span>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="SMS"
        description="Valores aplicados a cada nova campanha de SMS. Podem ser alterados campanha a campanha."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Identificador do remetente"
            htmlFor="sender-sms-id"
            required
            hint="Nome que aparece no telemóvel do cliente."
            error={errorFor("smsSenderId")}
          >
            <Input
              id="sender-sms-id"
              maxLength={11}
              value={draft.smsSenderId}
              onChange={(event) => update("smsSenderId", event.target.value)}
              className="uppercase"
            />
          </Field>
          <Field label="Janela de envio — início" htmlFor="sender-window-start">
            <Input
              id="sender-window-start"
              type="time"
              value={draft.windowStart}
              onChange={(event) => update("windowStart", event.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field
            label="Janela de envio — fim"
            htmlFor="sender-window-end"
            hint="Hora de Luanda."
            error={errorFor("windowEnd")}
          >
            <Input
              id="sender-window-end"
              type="time"
              value={draft.windowEnd}
              onChange={(event) => update("windowEnd", event.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>
      </SettingsPanel>

      <SaveBar
        dirty={dirty}
        saved={saved}
        onReset={() => {
          setDraft(senders);
          setSubmitted(false);
        }}
      />
    </form>
  );
}
