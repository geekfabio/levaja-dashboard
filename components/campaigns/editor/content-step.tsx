"use client";

import { useRef, useState } from "react";
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
import BlockEditor from "./block-editor";
import EmailPreview, { type PreviewDevice } from "./email-preview";
import VariableMenu from "./variable-menu";
import FallbacksSection from "./fallbacks-section";
import { usePreviewContact } from "./use-preview-contact";
import { BLOCK_LABELS, type BlockType, type Campaign } from "@/data/campaigns";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useSettingsStore } from "@/stores/settings-store";
import { emailFooter, emailSender } from "@/lib/settings";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type ContentStepProps = {
  campaign: Campaign;
  readOnly: boolean;
};

const DEVICES: { key: PreviewDevice; label: string }[] = [
  { key: "desktop", label: "Computador" },
  { key: "mobile", label: "Telemóvel" },
];

export default function ContentStep({ campaign, readOnly }: ContentStepProps) {
  const updateDetails = useCampaignsStore((state) => state.updateDetails);
  const addBlock = useCampaignsStore((state) => state.addBlock);
  const updateBlock = useCampaignsStore((state) => state.updateBlock);
  const removeBlock = useCampaignsStore((state) => state.removeBlock);
  const moveBlock = useCampaignsStore((state) => state.moveBlock);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const preview = usePreviewContact();
  const senders = useSettingsStore((state) => state.senders);
  const company = useSettingsStore((state) => state.company);
  const subjectRef = useRef<HTMLInputElement>(null);

  function insertInSubject(token: string) {
    const element = subjectRef.current;
    const position = element?.selectionStart ?? campaign.subject.length;
    updateDetails(campaign.id, {
      subject:
        campaign.subject.slice(0, position) + token + campaign.subject.slice(position),
    });
  }

  return (
    <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        {readOnly && (
          <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
            {campaign.status === "Em revisão"
              ? "Campanha em revisão — o conteúdo está bloqueado. Volte a rascunho em “Revisão e envio” para editar."
              : `Campanha ${campaign.status.toLowerCase()} — só leitura.`}
          </div>
        )}

        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <h2 className="eyebrow-style text-faint font-normal">Mensagem</h2>
          <Field
            label="Assunto"
            htmlFor="campaign-subject"
            required
            error={
              !readOnly && !campaign.subject.trim()
                ? "O assunto é obrigatório."
                : undefined
            }
            trailing={<VariableMenu onInsert={insertInSubject} disabled={readOnly} />}
          >
            <Input
              ref={subjectRef}
              id="campaign-subject"
              value={campaign.subject}
              disabled={readOnly}
              placeholder="Assunto do e-mail"
              onChange={(event) =>
                updateDetails(campaign.id, { subject: event.target.value })
              }
            />
          </Field>
          <Field
            label="Pré-cabeçalho"
            htmlFor="campaign-preheader"
            hint="Texto curto que aparece a seguir ao assunto na caixa de entrada."
          >
            <Input
              id="campaign-preheader"
              value={campaign.preheader}
              disabled={readOnly}
              onChange={(event) =>
                updateDetails(campaign.id, { preheader: event.target.value })
              }
            />
          </Field>
        </section>

        <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="eyebrow-style text-faint font-normal">
              Blocos · {campaign.blocks.length}
            </h2>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <PlusIcon aria-hidden className="size-3" />
                    Adicionar bloco
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onSelect={() => addBlock(campaign.id, type)}
                    >
                      {BLOCK_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {readOnly ? (
            <span className="caption-style text-subtle">
              {campaign.blocks.length} blocos — ver pré-visualização.
            </span>
          ) : (
            <div className="flex flex-col gap-3">
              {campaign.blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  index={index}
                  total={campaign.blocks.length}
                  onChange={(next) => updateBlock(campaign.id, next)}
                  onMove={(delta) => moveBlock(campaign.id, block.id, delta)}
                  onRemove={() => removeBlock(campaign.id, block.id)}
                />
              ))}
              {campaign.blocks.length === 0 && (
                <span className="caption-style text-subtle flex h-[60px] items-center justify-center rounded-lg border border-dashed border-line-strong">
                  Sem blocos. Adicione o primeiro.
                </span>
              )}
            </div>
          )}
        </section>

        <FallbacksSection campaign={campaign} readOnly={readOnly} />
      </div>

      <section className="border-border flex min-w-0 flex-col gap-4 self-start rounded-xl border p-5 xl:sticky xl:top-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow-style text-faint font-normal">Pré-visualização</h2>
          <div className="flex items-center gap-1">
            {DEVICES.map((item) => (
              <Button
                key={item.key}
                variant={item.key === device ? "primary" : "ghost"}
                size="sm"
                onClick={() => setDevice(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <FilterMenu
          label="Ver como"
          value={preview.contactId}
          options={preview.options}
          onChange={preview.setContactId}
          className="self-start"
        />
        <EmailPreview
          subject={campaign.subject}
          preheader={campaign.preheader}
          blocks={campaign.blocks}
          values={preview.values}
          fallbacks={campaign.fallbacks}
          device={device}
          sender={emailSender(senders)}
          footer={emailFooter(company)}
        />
      </section>
    </div>
  );
}
