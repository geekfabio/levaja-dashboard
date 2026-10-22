"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import EditFooter from "@/components/_common/editable/edit-footer";
import { useEditable } from "@/components/_common/editable/use-editable";
import OpportunityEditForm, {
  OPPORTUNITY_FORM_ID,
  opportunityDraftToPatch,
  opportunityToDraft,
  type OpportunityDraft,
} from "./opportunity-edit-form";
import DetailSection from "@/components/_common/detail-section";
import Tag from "@/components/_ui/tag";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_TONES,
  type OpportunityStage,
} from "@/data/opportunities";
import { formatDateLong, formatMoney } from "@/lib/format";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import ClipboardIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export default function OpportunityDetail() {
  const detailId = useOpportunitiesStore((state) => state.detailId);
  const detailOpen = useOpportunitiesStore((state) => state.detailOpen);
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const closeDetail = useOpportunitiesStore((state) => state.closeDetail);
  const requestStageMove = useOpportunitiesStore(
    (state) => state.requestStageMove,
  );

  const updateOpportunity = useOpportunitiesStore((state) => state.updateOpportunity);
  const editable = useEditable<OpportunityDraft>();
  const [editingFor, setEditingFor] = useState<string | null>(null);

  const opportunity = opportunities.find((item) => item.id === detailId);
  const editing = editable.editing && editingFor === opportunity?.id;

  function requestClose() {
    if (!editing) {
      editable.reset();
      closeDetail();
      return;
    }
    editable.requestClose(closeDetail);
  }

  return (
    <Sheet
      open={detailOpen && opportunity !== undefined}
      onOpenChange={(open) => !open && requestClose()}
    >
      <SheetContent side="right" className="sm:w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <ClipboardIcon aria-hidden className="text-icon size-3.5" />
            <SheetTitle>Detalhe da Oportunidade</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Resumo, fase e histórico da oportunidade
          </SheetDescription>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1"
            aria-label="Fechar detalhe"
            onClick={requestClose}
          >
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetHeader>

        {opportunity && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
              <h2 className="truncate">{opportunity.companyName}</h2>
              <span className="caption-style text-subtle">
                {opportunity.contactName}
              </span>
              <div className="flex flex-wrap items-center gap-[3px]">
                {opportunity.products.map((product) => (
                  <Tag key={product} tone="neutral" size="sm">
                    {product}
                  </Tag>
                ))}
              </div>
            </div>

            {editing && editable.draft ? (
              <OpportunityEditForm
                draft={editable.draft}
                onChange={editable.update}
                onSubmit={() => {
                  if (!editable.draft) return;
                  updateOpportunity(opportunity.id, opportunityDraftToPatch(editable.draft));
                  editable.reset();
                }}
              />
            ) : (
            <DetailSection title="Resumo">
              <div className="lead-style grid grid-cols-2 gap-3">
                <span className="text-subtle">Valor</span>
                <span className="text-right tabular-nums">
                  {formatMoney(opportunity.value)}
                </span>
                <span className="text-subtle">Probabilidade</span>
                <span className="text-right tabular-nums">
                  {opportunity.probability}%
                </span>
                <span className="text-subtle">Data prevista de fecho</span>
                <span className="text-right tabular-nums">
                  {formatDateLong(opportunity.expectedCloseDate)}
                </span>
                <span className="text-subtle">Gestor</span>
                <span className="text-right">{opportunity.owner}</span>
              </div>
            </DetailSection>
            )}

            <DetailSection title="Fase">
              <Select
                value={opportunity.stage}
                onValueChange={(value) =>
                  requestStageMove(opportunity.id, value as OpportunityStage)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {opportunity.stage === "Fechada - Perdida" &&
                opportunity.lossReason && (
                  <span className="caption-style text-danger flex items-center gap-1.5">
                    Motivo da perda:
                    <Tag tone="red" size="sm">
                      {opportunity.lossReason}
                    </Tag>
                  </span>
                )}
            </DetailSection>

            <DetailSection title="Histórico de fase" className="shadow-none">
              <ol className="flex flex-col gap-3">
                {[...opportunity.stageHistory]
                  .reverse()
                  .map((entry, index) => (
                    <li
                      key={`${entry.stage}-${entry.date}-${index}`}
                      className="flex items-start gap-3"
                    >
                      <span
                        aria-hidden
                        className="bg-subtle mt-1.5 size-1.5 shrink-0 rounded-full"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <Tag
                            tone={OPPORTUNITY_STAGE_TONES[entry.stage]}
                            size="sm"
                          >
                            {entry.stage}
                          </Tag>
                        </span>
                        <span className="caption-style text-subtle">
                          {formatDateLong(entry.date)} · {entry.author}
                        </span>
                      </span>
                    </li>
                  ))}
              </ol>
            </DetailSection>
          </div>
        )}

        <SheetFooter>
          <EditFooter
            editing={editing}
            dirty={editable.dirty}
            confirmingClose={editable.confirmingClose}
            saveForm={OPPORTUNITY_FORM_ID}
            onEdit={() => {
              if (!opportunity) return;
              setEditingFor(opportunity.id);
              editable.start(opportunityToDraft(opportunity));
            }}
            onCancel={editable.reset}
            onDiscard={() => {
              editable.reset();
              closeDetail();
            }}
            onClose={requestClose}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
