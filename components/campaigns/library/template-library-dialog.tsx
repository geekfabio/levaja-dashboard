"use client";

import { useState, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  BLANK_SMS_TEMPLATE,
  BLANK_TEMPLATE,
  CHANNEL_LABELS,
  DEFAULT_FALLBACKS,
  type CampaignTemplate,
  type Channel,
  type SmsTemplate,
} from "@/data/campaigns";
import { renderVariables } from "@/lib/campaigns";
import { OPT_OUT_SUFFIX, analyzeSms } from "@/lib/sms";
import { useCampaignsStore } from "@/stores/campaigns-store";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";

const CHANNELS: Channel[] = ["Email", "SMS"];

function EmailThumb({ template }: { template: CampaignTemplate }) {
  const banner = template.blocks.find((block) => block.type === "banner");
  const heading = template.blocks.find((block) => block.type === "heading");
  const hasButton = template.blocks.some((block) => block.type === "button");

  return (
    <div aria-hidden className="bg-brand-paper flex h-[132px] flex-col overflow-hidden rounded-md">
      <div className="bg-brand h-1" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        {banner && banner.type === "banner" && (
          <div
            className={cn(
              "truncate rounded px-2 py-2 text-center text-[10px] leading-none font-bold",
              banner.tone === "brand"
                ? "bg-brand text-brand-paper"
                : "bg-brand-accent text-brand-ink",
            )}
          >
            {banner.title}
          </div>
        )}
        {heading && heading.type === "heading" && (
          <div className="text-brand-ink truncate text-[10px] leading-none font-semibold">
            {heading.text.replace(/\{\{\s*\w+\s*\}\}/g, "…")}
          </div>
        )}
        <div className="bg-brand-ink/10 h-1.5 w-full rounded-full" />
        <div className="bg-brand-ink/10 h-1.5 w-4/5 rounded-full" />
        <div className="bg-brand-ink/10 h-1.5 w-3/5 rounded-full" />
        {hasButton && <div className="bg-brand mx-auto mt-auto h-3 w-14 rounded-sm" />}
      </div>
    </div>
  );
}

function SmsThumb({ template }: { template: SmsTemplate }) {
  const analysis = analyzeSms(
    renderVariables(template.body + OPT_OUT_SUFFIX, {}, DEFAULT_FALLBACKS),
  );
  return (
    <div aria-hidden className="bg-background flex h-[132px] flex-col gap-2 rounded-md border border-line-strong p-3">
      <div className="bg-secondary line-clamp-4 rounded-xl rounded-bl-sm px-2.5 py-2 text-[11px] leading-[1.35] text-foreground">
        {template.body}
      </div>
      <Tag
        tone={analysis.messages > 1 ? "amber" : "green"}
        size="sm"
        className="mt-auto self-start"
      >
        {analysis.messages === 1 ? "1 mensagem" : `${analysis.messages} mensagens`}
      </Tag>
    </div>
  );
}

function TemplateCard({
  name,
  description,
  primary,
  thumb,
  onUse,
}: {
  name: string;
  description: string;
  primary: boolean;
  thumb: ReactNode;
  onUse: () => void;
}) {
  return (
    <div className="border-border flex flex-col gap-3 rounded-xl border p-3">
      {thumb}
      <div className="flex flex-col gap-1">
        <span className="lead-style font-medium">{name}</span>
        <span className="caption-style text-subtle">{description}</span>
      </div>
      <Button
        variant={primary ? "primary" : "secondary"}
        size="sm"
        className="mt-auto self-start"
        onClick={onUse}
      >
        Usar modelo
      </Button>
    </div>
  );
}

export default function TemplateLibraryDialog() {
  const open = useCampaignsStore((state) => state.libraryOpen);
  const setOpen = useCampaignsStore((state) => state.setLibraryOpen);
  const createFromTemplate = useCampaignsStore((state) => state.createFromTemplate);
  const [channel, setChannel] = useState<Channel>("Email");
  const emailTemplates = useSettingsStore((state) => state.emailTemplates);
  const smsTemplates = useSettingsStore((state) => state.smsTemplates);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[880px]">
        <DialogHeader>
          <DialogTitle>Biblioteca de modelos</DialogTitle>
          <DialogDescription>
            Modelos com a marca Alimenta Angola. Escolha um para abrir no editor
            como rascunho.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 px-6 pt-4">
          {CHANNELS.map((item) => (
            <Button
              key={item}
              variant={item === channel ? "primary" : "ghost"}
              size="sm"
              onClick={() => setChannel(item)}
            >
              {CHANNEL_LABELS[item]}
            </Button>
          ))}
        </div>

        <ScrollArea className="max-h-[65dvh]">
          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {channel === "Email"
              ? [...emailTemplates, BLANK_TEMPLATE].map((template) => (
                  <TemplateCard
                    key={template.id}
                    name={template.name}
                    description={template.description}
                    primary={template.id !== BLANK_TEMPLATE.id}
                    thumb={<EmailThumb template={template} />}
                    onUse={() => createFromTemplate("Email", template.id)}
                  />
                ))
              : [...smsTemplates, BLANK_SMS_TEMPLATE].map((template) => (
                  <TemplateCard
                    key={template.id}
                    name={template.name}
                    description={template.description}
                    primary={template.id !== BLANK_SMS_TEMPLATE.id}
                    thumb={<SmsThumb template={template} />}
                    onUse={() => createFromTemplate("SMS", template.id)}
                  />
                ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
