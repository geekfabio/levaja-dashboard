"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import SettingsPanel from "../settings-panel";
import EmailTemplateEditor from "./email-template-editor";
import SmsTemplateEditor from "./sms-template-editor";
import {
  BLANK_SMS_TEMPLATE,
  BLANK_TEMPLATE,
  type CampaignTemplate,
  type Channel,
  type SmsTemplate,
} from "@/data/campaigns";
import { templateUsage } from "@/lib/settings";
import { useAutomationsStore } from "@/stores/automations-store";
import { useSettingsStore } from "@/stores/settings-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type Editing =
  | { channel: "Email"; template: CampaignTemplate; isNew: boolean }
  | { channel: "SMS"; template: SmsTemplate; isNew: boolean };

function newTemplateId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function copyName(name: string) {
  return `${name} (cópia)`;
}

type TemplateRowProps = {
  name: string;
  description: string;
  meta: string;
  usedBy: string[];
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

function TemplateRow({
  name,
  description,
  meta,
  usedBy,
  onEdit,
  onDuplicate,
  onRemove,
}: TemplateRowProps) {
  const locked = usedBy.length > 0;

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="lead-style font-medium">{name}</span>
          <Tag tone="neutral" size="sm">
            {meta}
          </Tag>
        </span>
        <span className="caption-style text-subtle">{description || "Sem descrição."}</span>
        {locked && (
          <span className="caption-style text-soft">
            Usado em: {usedBy.join(", ")}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDuplicate}>
          Duplicar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={locked}
          title={locked ? "Em uso numa automação — retire-o primeiro." : undefined}
          onClick={onRemove}
        >
          Eliminar
        </Button>
      </div>
    </li>
  );
}

export default function TemplatesTab() {
  const emailTemplates = useSettingsStore((state) => state.emailTemplates);
  const smsTemplates = useSettingsStore((state) => state.smsTemplates);
  const saveEmailTemplate = useSettingsStore((state) => state.saveEmailTemplate);
  const saveSmsTemplate = useSettingsStore((state) => state.saveSmsTemplate);
  const removeEmailTemplate = useSettingsStore((state) => state.removeEmailTemplate);
  const removeSmsTemplate = useSettingsStore((state) => state.removeSmsTemplate);
  const automations = useAutomationsStore((state) => state.automations);
  const [editing, setEditing] = useState<Editing | null>(null);

  if (editing?.channel === "Email") {
    return (
      <EmailTemplateEditor
        template={editing.template}
        isNew={editing.isNew}
        onClose={() => setEditing(null)}
      />
    );
  }
  if (editing?.channel === "SMS") {
    return (
      <SmsTemplateEditor
        template={editing.template}
        isNew={editing.isNew}
        onClose={() => setEditing(null)}
      />
    );
  }

  function usage(channel: Channel, id: string) {
    return templateUsage(automations, channel, id);
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <p className="caption-style text-subtle max-w-[60em]">
        Os modelos guardados aqui aparecem na biblioteca de Campanhas e podem ser usados nos
        passos das Automações. Um modelo em uso numa automação não pode ser eliminado.
      </p>

      <SettingsPanel
        title={`Modelos de e-mail · ${emailTemplates.length}`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              setEditing({
                channel: "Email",
                isNew: true,
                template: {
                  ...BLANK_TEMPLATE,
                  id: newTemplateId("modelo"),
                  name: "",
                  description: "",
                },
              })
            }
          >
            <PlusIcon aria-hidden className="size-3" />
            Novo modelo
          </Button>
        }
      >
        <ul className="divide-border flex flex-col divide-y">
          {emailTemplates.map((template) => (
            <TemplateRow
              key={template.id}
              name={template.name}
              description={template.description}
              meta={`${template.blocks.length} blocos`}
              usedBy={usage("Email", template.id)}
              onEdit={() => setEditing({ channel: "Email", template, isNew: false })}
              onDuplicate={() =>
                saveEmailTemplate({
                  ...template,
                  id: newTemplateId("modelo"),
                  name: copyName(template.name),
                })
              }
              onRemove={() => removeEmailTemplate(template.id)}
            />
          ))}
        </ul>
      </SettingsPanel>

      <SettingsPanel
        title={`Modelos de SMS · ${smsTemplates.length}`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              setEditing({
                channel: "SMS",
                isNew: true,
                template: {
                  ...BLANK_SMS_TEMPLATE,
                  id: newTemplateId("sms-modelo"),
                  name: "",
                  description: "",
                },
              })
            }
          >
            <PlusIcon aria-hidden className="size-3" />
            Novo modelo
          </Button>
        }
      >
        <ul className="divide-border flex flex-col divide-y">
          {smsTemplates.map((template) => (
            <TemplateRow
              key={template.id}
              name={template.name}
              description={template.description}
              meta={`${template.body.length} caracteres`}
              usedBy={usage("SMS", template.id)}
              onEdit={() => setEditing({ channel: "SMS", template, isNew: false })}
              onDuplicate={() =>
                saveSmsTemplate({
                  ...template,
                  id: newTemplateId("sms-modelo"),
                  name: copyName(template.name),
                })
              }
              onRemove={() => removeSmsTemplate(template.id)}
            />
          ))}
        </ul>
      </SettingsPanel>
    </div>
  );
}
