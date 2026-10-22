"use client";

import type { MouseEvent } from "react";
import Asset from "@/components/_ui/asset";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Tag from "@/components/_ui/tag";
import SegmentBar from "@/components/_common/segment-bar";
import { TAG_TONES, ownerByName, type Company } from "@/data/companies";
import { formatDate, formatMoney } from "@/lib/companies";
import { cn } from "@/lib/utils";
import CalendarIcon from "@/public/assets/images/_common/calendar.svg";

type CompanyCardProps = {
  company: Company;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onOpenOwner: () => void;
};

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function dealsLabel(count: number) {
  return count === 1 ? "1 oportunidade aberta" : `${count} oportunidades abertas`;
}

export default function CompanyCard({
  company,
  selected,
  active,
  onToggle,
  onOpen,
  onOpenOwner,
}: CompanyCardProps) {
  const owner = ownerByName(company.owner);
  const [primaryTag, ...otherTags] = company.tags;

  return (
    <article
      onClick={onOpen}
      data-selected={selected}
      data-active={active}
      className={cn(
        "group bg-card relative flex w-full cursor-pointer flex-col gap-4 rounded-xl p-4 transition-[background-color,box-shadow] duration-150 ease-power3-out",
        "shadow-[0px_4px_4px_0px_rgba(42,42,42,0.32),0px_0px_0px_1px_var(--edge),inset_0px_1px_0px_0px_rgba(255,255,255,0.08),inset_0px_0px_0px_1px_rgba(255,255,255,0.08)] hover:bg-[var(--edge-soft)]",
        "data-[active=true]:bg-[var(--edge-soft)] data-[selected=true]:shadow-[0px_0px_0px_1px_var(--edge),inset_0px_0px_0px_1px_rgba(255,255,255,0.28)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-[10px] shadow-[0px_0px_0px_1px_var(--border)]">
          {company.logo ? (
            <Asset
              type="image"
              src={company.logo}
              alt=""
              width={1}
              height={1}
              fit="contain"
              className="size-6"
            />
          ) : (
            <span aria-hidden className="lead-style text-soft">
              {company.name.slice(0, 1)}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="min-w-0">
            <Button
              variant="link"
              size="none"
              title={company.name}
              className="block max-w-full truncate text-left no-underline"
              onClick={(event) => {
                stop(event);
                onOpen();
              }}
            >
              {company.name}
            </Button>
          </h3>
          <span className="flex min-w-0 items-center gap-[3px]" title={company.tags.join(", ")}>
            {primaryTag && (
              <Tag tone={TAG_TONES[primaryTag]} size="sm" className="min-w-0 truncate">
                {primaryTag}
              </Tag>
            )}
            {otherTags.length > 0 && (
              <Tag tone="neutral" size="sm">
                +{otherTags.length}
                <span className="sr-only">: {otherTags.join(", ")}</span>
              </Tag>
            )}
          </span>
        </div>
        <span onClick={stop} className="-mt-0.5 -mr-0.5 flex size-6 shrink-0 items-center justify-center">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Selecionar ${company.name}`}
          />
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[20px] leading-none font-medium tabular-nums">
          {formatMoney(company.pipelineValue)}
        </span>
        <span className="caption-style text-subtle">
          {dealsLabel(company.openDeals)} · {company.zone}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <SegmentBar percent={company.winProbability} className="min-w-0 flex-1" />
        <span className="caption-style text-soft w-[4ch] shrink-0 text-right tabular-nums">
          {company.winProbability}%
        </span>
        <span className="sr-only">de probabilidade de fecho</span>
      </div>

      <div className="border-line-strong caption-style mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <Button
          variant="ghost"
          size="none"
          onClick={(event) => {
            stop(event);
            onOpenOwner();
          }}
          aria-label={`Abrir perfil de ${owner.name}`}
          className="text-foreground -mx-1.5 min-w-0 gap-1.5 px-1.5 py-1 font-normal"
        >
          <Avatar src={owner.avatar} alt="" />
          <span className="truncate">{owner.name}</span>
        </Button>
        <span className="text-subtle flex min-w-0 items-center gap-1" title={company.lastInteraction.label}>
          <CalendarIcon aria-hidden className="size-3 shrink-0" />
          <span className="tabular-nums">{formatDate(company.lastInteraction.date)}</span>
        </span>
      </div>
    </article>
  );
}
