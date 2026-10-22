"use client";

import { useRef, useState, type FormEvent } from "react";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import Tag from "@/components/_ui/tag";
import VariableMenu from "@/components/campaigns/editor/variable-menu";
import SettingsPanel from "../settings-panel";
import TemplateEditorHeader from "./template-editor-header";
import { DEFAULT_FALLBACKS, type SmsTemplate } from "@/data/campaigns";
import { renderVariables } from "@/lib/campaigns";
import { formatMoney } from "@/lib/format";
import { nameTaken } from "@/lib/settings";
import { OPT_OUT_SUFFIX, SMS_MESSAGE_UNITS, SMS_PRICE, analyzeSms } from "@/lib/sms";
import { useSettingsStore } from "@/stores/settings-store";

type SmsTemplateEditorProps = {
  template: SmsTemplate;
  isNew: boolean;
  onClose: () => void;
};

export default function SmsTemplateEditor({ template, isNew, onClose }: SmsTemplateEditorProps) {
  const templates = useSettingsStore((state) => state.smsTemplates);
  const saveSmsTemplate = useSettingsStore((state) => state.saveSmsTemplate);
  const senderId = useSettingsStore((state) => state.senders.smsSenderId);
  const [draft, setDraft] = useState({
    name: template.name,
    description: template.description,
    body: template.body,
  });
  const [submitted, setSubmitted] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const rendered = renderVariables(draft.body + OPT_OUT_SUFFIX, {}, DEFAULT_FALLBACKS);
  const analysis = analyzeSms(rendered);

  const nameError = !draft.name.trim()
    ? "Indique o nome do modelo."
    : nameTaken(
          templates.map((item) => item.name),
          draft.name,
          isNew ? undefined : template.name,
        )
      ? "Já existe um modelo com este nome."
      : undefined;
  const bodyError = draft.body.trim() ? undefined : "A mensagem é obrigatória.";

  function insertVariable(token: string) {
    const position = bodyRef.current?.selectionStart ?? draft.body.length;
    setDraft((current) => ({
      ...current,
      body: current.body.slice(0, position) + token + current.body.slice(position),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (nameError || bodyError) return;
    saveSmsTemplate({
      id: template.id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      body: draft.body.trim(),
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      <TemplateEditorHeader
        title={isNew ? "Novo modelo de SMS" : `Editar · ${template.name}`}
        onClose={onClose}
      />

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <SettingsPanel title="Modelo">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome"
              htmlFor="sms-template-name"
              required
              error={submitted ? nameError : undefined}
            >
              <Input
                id="sms-template-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                autoFocus={isNew}
              />
            </Field>
            <Field label="Descrição" htmlFor="sms-template-description">
              <Input
                id="sms-template-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Texto do SMS"
            htmlFor="sms-template-body"
            required
            error={submitted ? bodyError : undefined}
            trailing={<VariableMenu onInsert={insertVariable} />}
          >
            <Textarea
              ref={bodyRef}
              id="sms-template-body"
              rows={5}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <Tag tone={analysis.messages > 1 ? "amber" : "green"} size="sm">
              {analysis.messages === 1 ? "1 mensagem" : `${analysis.messages} mensagens`}
            </Tag>
            <span className="caption-style text-soft tabular-nums">
              {analysis.units} de {analysis.messages * SMS_MESSAGE_UNITS} unidades ·{" "}
              {formatMoney(analysis.messages * SMS_PRICE)} por destinatário
            </span>
          </div>
          <span className="caption-style text-subtle">
            Contagem com os valores por omissão das variáveis e com a instrução de remoção
            (&ldquo;{OPT_OUT_SUFFIX.trim()}&rdquo;). Letras com acento contam 2 unidades.
          </span>
          {analysis.doubleChars.length > 0 && (
            <span className="caption-style text-warning">
              Caracteres que contam 2: {analysis.doubleChars.join(" ")}
            </span>
          )}
        </SettingsPanel>

        <SettingsPanel title="Pré-visualização" className="self-start">
          <div className="bg-background flex flex-col gap-2 rounded-xl border border-line-strong p-4">
            <span className="caption-style text-subtle text-center">{senderId}</span>
            <div className="bg-secondary max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2.5 text-[14px] leading-[1.4] break-words whitespace-pre-wrap">
              {rendered}
            </div>
          </div>
        </SettingsPanel>
      </div>
    </form>
  );
}
