"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import FilterMenu from "@/components/_common/filter-menu";
import BlockEditor from "@/components/campaigns/editor/block-editor";
import EmailPreview, { type PreviewDevice } from "@/components/campaigns/editor/email-preview";
import VariableMenu from "@/components/campaigns/editor/variable-menu";
import { usePreviewContact } from "@/components/campaigns/editor/use-preview-contact";
import SettingsPanel from "../settings-panel";
import TemplateEditorHeader from "./template-editor-header";
import {
  BLOCK_LABELS,
  DEFAULT_FALLBACKS,
  blocksFromTemplate,
  type BlockType,
  type CampaignBlock,
  type CampaignTemplate,
} from "@/data/campaigns";
import { createBlock } from "@/lib/campaigns";
import { emailFooter, emailSender, nameTaken, stripBlockIds } from "@/lib/settings";
import { useSettingsStore } from "@/stores/settings-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type EmailTemplateEditorProps = {
  template: CampaignTemplate;
  isNew: boolean;
  onClose: () => void;
};

const DEVICES: { key: PreviewDevice; label: string }[] = [
  { key: "desktop", label: "Computador" },
  { key: "mobile", label: "Telemóvel" },
];

export default function EmailTemplateEditor({
  template,
  isNew,
  onClose,
}: EmailTemplateEditorProps) {
  const templates = useSettingsStore((state) => state.emailTemplates);
  const saveEmailTemplate = useSettingsStore((state) => state.saveEmailTemplate);
  const senders = useSettingsStore((state) => state.senders);
  const company = useSettingsStore((state) => state.company);
  const preview = usePreviewContact();
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: template.name,
    description: template.description,
    subject: template.subject,
    preheader: template.preheader,
    blocks: blocksFromTemplate(template, template.id),
  }));
  const subjectRef = useRef<HTMLInputElement>(null);

  const nameError = !draft.name.trim()
    ? "Indique o nome do modelo."
    : nameTaken(
          templates.map((item) => item.name),
          draft.name,
          isNew ? undefined : template.name,
        )
      ? "Já existe um modelo com este nome."
      : undefined;
  const subjectError = draft.subject.trim() ? undefined : "O assunto é obrigatório.";
  const blocksError = draft.blocks.length === 0 ? "Adicione pelo menos um bloco." : undefined;
  const valid = !nameError && !subjectError && !blocksError;

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBlock(next: CampaignBlock) {
    update(
      "blocks",
      draft.blocks.map((block) => (block.id === next.id ? next : block)),
    );
  }

  function moveBlock(id: string, delta: number) {
    const index = draft.blocks.findIndex((block) => block.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= draft.blocks.length) return;
    const blocks = [...draft.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    update("blocks", blocks);
  }

  function addBlock(type: BlockType) {
    update("blocks", [
      ...draft.blocks,
      createBlock(type, `${template.id}-${crypto.randomUUID().slice(0, 8)}`),
    ]);
  }

  function insertInSubject(token: string) {
    const position = subjectRef.current?.selectionStart ?? draft.subject.length;
    update("subject", draft.subject.slice(0, position) + token + draft.subject.slice(position));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    saveEmailTemplate({
      id: template.id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      subject: draft.subject.trim(),
      preheader: draft.preheader.trim(),
      blocks: stripBlockIds(draft.blocks),
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      <TemplateEditorHeader
        title={isNew ? "Novo modelo de e-mail" : `Editar · ${template.name}`}
        onClose={onClose}
      />

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsPanel title="Modelo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome"
                htmlFor="template-name"
                required
                error={submitted ? nameError : undefined}
              >
                <Input
                  id="template-name"
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  autoFocus={isNew}
                />
              </Field>
              <Field
                label="Descrição"
                htmlFor="template-description"
                hint="Aparece no cartão da biblioteca."
              >
                <Input
                  id="template-description"
                  value={draft.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Assunto"
              htmlFor="template-subject"
              required
              error={submitted ? subjectError : undefined}
              trailing={<VariableMenu onInsert={insertInSubject} />}
            >
              <Input
                ref={subjectRef}
                id="template-subject"
                value={draft.subject}
                onChange={(event) => update("subject", event.target.value)}
              />
            </Field>
            <Field label="Pré-cabeçalho" htmlFor="template-preheader">
              <Input
                id="template-preheader"
                value={draft.preheader}
                onChange={(event) => update("preheader", event.target.value)}
              />
            </Field>
          </SettingsPanel>

          <SettingsPanel
            title={`Blocos · ${draft.blocks.length}`}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="secondary" size="sm">
                    <PlusIcon aria-hidden className="size-3" />
                    Adicionar bloco
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                    <DropdownMenuItem key={type} onSelect={() => addBlock(type)}>
                      {BLOCK_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          >
            <div className="flex flex-col gap-3">
              {draft.blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  index={index}
                  total={draft.blocks.length}
                  onChange={updateBlock}
                  onMove={(delta) => moveBlock(block.id, delta)}
                  onRemove={() =>
                    update(
                      "blocks",
                      draft.blocks.filter((item) => item.id !== block.id),
                    )
                  }
                />
              ))}
              {draft.blocks.length === 0 && (
                <span className="caption-style text-subtle flex h-[60px] items-center justify-center rounded-lg border border-dashed border-line-strong">
                  Sem blocos. Adicione o primeiro.
                </span>
              )}
              {submitted && blocksError && (
                <span role="alert" className="caption-style text-danger">
                  {blocksError}
                </span>
              )}
            </div>
          </SettingsPanel>
        </div>

        <SettingsPanel
          title="Pré-visualização"
          className="self-start xl:sticky xl:top-5"
          actions={
            <div className="flex items-center gap-1">
              {DEVICES.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={item.key === device ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setDevice(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          }
        >
          <FilterMenu
            label="Ver como"
            value={preview.contactId}
            options={preview.options}
            onChange={preview.setContactId}
            className="self-start"
          />
          <EmailPreview
            subject={draft.subject}
            preheader={draft.preheader}
            blocks={draft.blocks}
            values={preview.values}
            fallbacks={DEFAULT_FALLBACKS}
            device={device}
            sender={emailSender(senders)}
            footer={emailFooter(company)}
          />
        </SettingsPanel>
      </div>
    </form>
  );
}
