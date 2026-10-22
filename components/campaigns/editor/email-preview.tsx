import Asset from "@/components/_ui/asset";
import {
  BRAND_LOGO,
  type CampaignBlock,
  type Fallbacks,
} from "@/data/campaigns";
import { renderVariables, type VariableValues } from "@/lib/campaigns";
import { cn } from "@/lib/utils";

export type PreviewDevice = "desktop" | "mobile";

type EmailPreviewProps = {
  subject: string;
  preheader: string;
  blocks: CampaignBlock[];
  values: VariableValues;
  fallbacks: Fallbacks;
  device: PreviewDevice;
  sender: string;
  footer: string;
};

function PreviewBlock({
  block,
  render,
}: {
  block: CampaignBlock;
  render: (text: string) => string;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="text-[22px] leading-[1.25] font-semibold tracking-[-0.01em]">
          {render(block.text)}
        </div>
      );
    case "text":
      return (
        <div className="text-brand-ink/80 text-[15px] leading-[1.6] whitespace-pre-line">
          {render(block.text) || " "}
        </div>
      );
    case "banner":
      return (
        <div
          className={cn(
            "flex flex-col gap-1 rounded-lg px-5 py-6 text-center",
            block.tone === "brand"
              ? "bg-brand text-brand-paper"
              : "bg-brand-accent text-brand-ink",
          )}
        >
          <span className="text-[24px] leading-[1.15] font-bold tracking-[-0.01em]">
            {render(block.title)}
          </span>
          {block.subtitle && (
            <span className="text-[15px] leading-[1.4]">{render(block.subtitle)}</span>
          )}
        </div>
      );
    case "image":
      return (
        <Asset
          type="image"
          src={block.src}
          alt={block.alt}
          width={96}
          height={64}
          fit="contain"
          className="mx-auto h-20 w-[120px]"
        />
      );
    case "button":
      return (
        <div className="flex justify-center">
          <span className="bg-brand text-brand-paper inline-flex rounded-md px-6 py-3 text-[15px] leading-none font-semibold">
            {render(block.label)}
          </span>
        </div>
      );
    case "divider":
      return <div aria-hidden className="bg-brand-ink/10 h-px w-full" />;
  }
}

export default function EmailPreview({
  subject,
  preheader,
  blocks,
  values,
  fallbacks,
  device,
  sender,
  footer,
}: EmailPreviewProps) {
  const render = (text: string) => renderVariables(text, values, fallbacks);

  return (
    <div className="flex flex-col gap-3">
      <div className="caption-style flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
        <span className="text-subtle truncate">De: {sender}</span>
        <span className="text-foreground truncate font-medium">
          {render(subject) || "Sem assunto"}
        </span>
        {preheader && (
          <span className="text-subtle truncate">{render(preheader)}</span>
        )}
      </div>

      <div
        className={cn(
          "bg-brand-paper text-brand-ink ease-power3-out mx-auto w-full overflow-hidden rounded-lg transition-[max-width] duration-300",
          device === "desktop" ? "max-w-[600px]" : "max-w-[360px]",
        )}
      >
        <div className="flex items-center justify-center px-6 py-4">
          <Asset
            type="image"
            src={BRAND_LOGO}
            alt="Alimenta Angola"
            width={96}
            height={64}
            fit="contain"
            className="h-10 w-[60px]"
          />
        </div>
        <div aria-hidden className="bg-brand h-1.5" />

        <div
          className={cn(
            "flex flex-col gap-5",
            device === "desktop" ? "px-10 py-8" : "px-5 py-6",
          )}
        >
          {blocks.map((block) => (
            <PreviewBlock key={block.id} block={block} render={render} />
          ))}
          {blocks.length === 0 && (
            <div className="text-brand-ink/50 py-8 text-center text-[14px]">
              Sem blocos — adicione conteúdo à campanha.
            </div>
          )}
        </div>

        <div className="bg-brand-ink/5 text-brand-ink/60 flex flex-col gap-1 px-6 py-5 text-center text-[12px] leading-[1.5]">
          <span>{footer}</span>
          <span>
            Recebe este e-mail por ser cliente da Alimenta Angola.{" "}
            <span className="underline">Remover subscrição</span>
          </span>
        </div>
      </div>
    </div>
  );
}
