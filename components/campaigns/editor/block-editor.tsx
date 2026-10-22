"use client";

import { useRef } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Textarea } from "@/components/_ui/textarea";
import Tag from "@/components/_ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import VariableMenu from "./variable-menu";
import {
  BANNER_TONE_LABELS,
  BLOCK_LABELS,
  type BannerTone,
  type CampaignBlock,
} from "@/data/campaigns";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

type BlockEditorProps = {
  block: CampaignBlock;
  index: number;
  total: number;
  onChange: (block: CampaignBlock) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
};

function insertAtCursor(
  value: string,
  token: string,
  element: HTMLInputElement | HTMLTextAreaElement | null,
) {
  const position = element?.selectionStart ?? value.length;
  return value.slice(0, position) + token + value.slice(position);
}

export default function BlockEditor({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: BlockEditorProps) {
  const primaryRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const fieldId = (name: string) => `${block.id}-${name}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line-strong bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Tag tone="neutral" size="sm">
          {BLOCK_LABELS[block.type]}
        </Tag>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mover bloco para cima"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronIcon aria-hidden className="size-3 rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mover bloco para baixo"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronIcon aria-hidden className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remover bloco"
            onClick={onRemove}
          >
            <XIcon aria-hidden className="size-3.5" />
          </Button>
        </div>
      </div>

      {block.type === "heading" && (
        <Field
          label="Título"
          htmlFor={fieldId("text")}
          trailing={
            <VariableMenu
              onInsert={(token) =>
                onChange({
                  ...block,
                  text: insertAtCursor(block.text, token, primaryRef.current),
                })
              }
            />
          }
        >
          <Input
            ref={primaryRef}
            id={fieldId("text")}
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
        </Field>
      )}

      {block.type === "text" && (
        <Field
          label="Texto"
          htmlFor={fieldId("text")}
          trailing={
            <VariableMenu
              onInsert={(token) =>
                onChange({
                  ...block,
                  text: insertAtCursor(block.text, token, primaryRef.current),
                })
              }
            />
          }
        >
          <Textarea
            ref={primaryRef}
            id={fieldId("text")}
            value={block.text}
            rows={4}
            placeholder="Escreva o texto do bloco"
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
        </Field>
      )}

      {block.type === "banner" && (
        <>
          <Field
            label="Título do destaque"
            htmlFor={fieldId("title")}
            trailing={
              <VariableMenu
                onInsert={(token) =>
                  onChange({
                    ...block,
                    title: insertAtCursor(block.title, token, primaryRef.current),
                  })
                }
              />
            }
          >
            <Input
              ref={primaryRef}
              id={fieldId("title")}
              value={block.title}
              onChange={(event) => onChange({ ...block, title: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Subtítulo" htmlFor={fieldId("subtitle")}>
              <Input
                id={fieldId("subtitle")}
                value={block.subtitle}
                onChange={(event) =>
                  onChange({ ...block, subtitle: event.target.value })
                }
              />
            </Field>
            <Field label="Cor" htmlFor={fieldId("tone")}>
              <Select
                value={block.tone}
                onValueChange={(value) =>
                  onChange({ ...block, tone: value as BannerTone })
                }
              >
                <SelectTrigger id={fieldId("tone")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BANNER_TONE_LABELS) as BannerTone[]).map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {BANNER_TONE_LABELS[tone]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </>
      )}

      {block.type === "image" && (
        <Field
          label="Texto alternativo"
          htmlFor={fieldId("alt")}
          hint="Só o logótipo da marca está disponível. Carregar imagens novas depende do Supabase Storage."
        >
          <Input
            id={fieldId("alt")}
            value={block.alt}
            onChange={(event) => onChange({ ...block, alt: event.target.value })}
          />
        </Field>
      )}

      {block.type === "button" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Texto do botão" htmlFor={fieldId("label")}>
            <Input
              id={fieldId("label")}
              value={block.label}
              onChange={(event) => onChange({ ...block, label: event.target.value })}
            />
          </Field>
          <Field label="Ligação" htmlFor={fieldId("href")}>
            <Input
              id={fieldId("href")}
              type="url"
              value={block.href}
              onChange={(event) => onChange({ ...block, href: event.target.value })}
            />
          </Field>
        </div>
      )}

      {block.type === "divider" && (
        <span className="caption-style text-subtle">
          Linha horizontal entre secções.
        </span>
      )}
    </div>
  );
}
