"use client";

import { useState } from "react";
import Asset from "@/components/_ui/asset";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import FilterMenu from "@/components/_common/filter-menu";
import DetailSection from "@/components/_common/detail-section";
import PipelineHealth from "./pipeline-health";
import ActivityTrend from "./activity-trend";
import ScoreCard from "./score-card";
import ClientTimeline from "./client-timeline";
import Purchases from "./purchases";
import NextFollowUp from "./next-follow-up";
import FiscalProfile from "./fiscal-profile";
import Documents from "./documents";
import CompanyEditForm, {
  COMPANY_FORM_ID,
  companyToDraft,
  draftToPatch,
  type CompanyDraft,
} from "./company-edit-form";
import EditFooter from "@/components/_common/editable/edit-footer";
import { useEditable } from "@/components/_common/editable/use-editable";
import { TAG_TONES, TREND_WINDOWS, ownerByName } from "@/data/companies";
import { TREND_WINDOW_DAYS, companyScoreCards } from "@/lib/company-insights";
import { useTicketsStore } from "@/stores/tickets-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useUiStore } from "@/stores/ui-store";
import BuildingIcon from "@/public/assets/images/companies/detail/building.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import MailIcon from "@/public/assets/images/companies/detail/mail-04.svg";
import PhoneIcon from "@/public/assets/images/companies/detail/phone.svg";

const WINDOW_OPTIONS = TREND_WINDOWS.map((label) => ({ value: label, label }));

export default function CompanyDetail() {
  const detailId = useCompaniesStore((state) => state.detailId);
  const detailOpen = useCompaniesStore((state) => state.detailOpen);
  const companies = useCompaniesStore((state) => state.companies);
  const closeDetail = useCompaniesStore((state) => state.closeDetail);
  const openProfile = useCompaniesStore((state) => state.openProfile);
  const [trendWindow, setTrendWindow] = useState(TREND_WINDOWS[1]);
  const updateCompany = useCompaniesStore((state) => state.updateCompany);
  const archiveCompanies = useCompaniesStore((state) => state.archiveCompanies);
  const tickets = useTicketsStore((state) => state.tickets);
  const editable = useEditable<CompanyDraft>();
  const [editingFor, setEditingFor] = useState<string | null>(null);

  const company = companies.find((item) => item.id === detailId);
  const owner = company ? ownerByName(company.owner) : null;
  const editing = editable.editing && editingFor === company?.id;

  function requestClose() {
    if (!editing) {
      editable.reset();
      closeDetail();
      return;
    }
    editable.requestClose(closeDetail);
  }

  function save() {
    if (!company || !editable.draft) return;
    updateCompany(company.id, draftToPatch(company, editable.draft));
    editable.reset();
  }

  return (
    <Sheet
      open={detailOpen && company !== undefined}
      onOpenChange={(open) => !open && requestClose()}
    >
      <SheetContent side="right" className="sm:w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <BuildingIcon aria-hidden className="text-icon size-3.5" />
            <SheetTitle>Detalhe do Cliente</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Resumo da conta, saúde do funil, atividade e cartões de pontuação
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

        {company && editing && editable.draft && (
          <ScrollArea className="min-h-0 flex-1">
            <CompanyEditForm draft={editable.draft} onChange={editable.update} onSubmit={save} />
          </ScrollArea>
        )}

        {company && owner && !editing && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex items-start gap-3 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
              <span className="bg-muted flex size-[50px] shrink-0 items-center justify-center rounded-[12.5px] shadow-[0px_6.25px_6.25px_0px_rgba(15,15,15,0.24),0px_0px_0px_1.563px_var(--border)]">
                {company.logo ? (
                  <Asset
                    type="image"
                    src={company.logo}
                    alt={`${company.name} logo`}
                    width={1}
                    height={1}
                    fit="contain"
                    className="size-8"
                  />
                ) : (
                  <span className="h2-style text-soft">
                    {company.name.slice(0, 1)}
                  </span>
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-3">
                <h2 className="truncate">{company.name}</h2>
                <div className="flex flex-wrap items-center gap-[3px]">
                  {company.tags.map((tag) => (
                    <Tag key={tag} tone={TAG_TONES[tag]} size="sm">
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            <DetailSection title="Resumo da conta">
              <div className="lead-style flex flex-wrap items-center gap-x-4 gap-y-3">
                <Button
                  variant="ghost"
                  size="none"
                  onClick={() => openProfile(owner.name)}
                  aria-label={`Abrir perfil de ${owner.name}`}
                  className="lead-style text-foreground -mx-1.5 gap-1.5 px-1.5 py-1 font-medium"
                >
                  <Avatar src={owner.avatar} alt="" />
                  {owner.name}
                </Button>
                <span className="flex items-center gap-1">
                  <MailIcon aria-hidden className="text-soft size-3" />
                  {owner.email}
                </span>
                <span className="flex items-center gap-1">
                  <PhoneIcon aria-hidden className="text-soft size-3" />
                  {owner.phone}
                </span>
              </div>
            </DetailSection>

            <DetailSection title="Próximo contacto">
              <NextFollowUp company={company} />
            </DetailSection>

            <DetailSection title="Compras">
              <Purchases companyId={company.id} companyName={company.name} />
            </DetailSection>

            <DetailSection title="Dados fiscais e crédito">
              <FiscalProfile key={company.id} company={company} />
            </DetailSection>

            <DetailSection title="Documentos">
              <Documents companyId={company.id} />
            </DetailSection>

            <DetailSection title="Linha do tempo">
              <ClientTimeline companyId={company.id} />
            </DetailSection>

            <DetailSection title="Saúde do funil">
              <PipelineHealth company={company} />
            </DetailSection>

            <DetailSection
              title="Tendência de atividade"
              action={
                <FilterMenu
                  value={trendWindow}
                  options={WINDOW_OPTIONS}
                  onChange={setTrendWindow}
                  align="end"
                />
              }
            >
              <ActivityTrend companyId={company.id} days={TREND_WINDOW_DAYS[trendWindow]} />
            </DetailSection>

            <DetailSection
              title="Cartão de pontuação"
              className="gap-3 shadow-none"
            >
              <div className="flex flex-col gap-2">
                {companyScoreCards(company, tickets, owner.avatar).map((card, index) => (
                  <ScoreCard key={`${card.title}-${index}`} card={card} />
                ))}
              </div>
            </DetailSection>
          </ScrollArea>
        )}

        <SheetFooter>
          <EditFooter
            editing={editing}
            dirty={editable.dirty}
            confirmingClose={editable.confirmingClose}
            saveForm={COMPANY_FORM_ID}
            onEdit={() => {
              if (!company) return;
              setEditingFor(company.id);
              editable.start(companyToDraft(company));
            }}
            onCancel={editable.reset}
            onDiscard={() => {
              editable.reset();
              closeDetail();
            }}
            onClose={requestClose}
            extra={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => company && archiveCompanies([company.id])}
                >
                  Arquivar
                </Button>
                <Button
                  variant="link"
                  size="none"
                  className="caption-style hidden sm:inline-flex"
                  onClick={() => useUiStore.getState().setHelpOpen(true)}
                >
                  Precisa de ajuda?
                </Button>
              </>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
