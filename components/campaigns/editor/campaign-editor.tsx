"use client";

import { useMemo } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import Tag from "@/components/_ui/tag";
import ContentStep from "./content-step";
import SmsContentStep from "./sms-content-step";
import ResultsStep from "./results-step";
import AudienceStep from "./audience-step";
import ReviewStep from "./review-step";
import {
  CHANNEL_LABELS,
  CHANNEL_TONES,
  STATUS_TONES,
  type Campaign,
} from "@/data/campaigns";
import { buildAudience } from "@/lib/campaigns";
import { useCampaignsStore, type EditorStep } from "@/stores/campaigns-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useUiStore } from "@/stores/ui-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

type CampaignEditorProps = {
  campaign: Campaign;
};

export default function CampaignEditor({ campaign }: CampaignEditorProps) {
  const step = useCampaignsStore((state) => state.editorStep);
  const setStep = useCampaignsStore((state) => state.setEditorStep);
  const closeEditor = useCampaignsStore((state) => state.closeEditor);
  const updateDetails = useCampaignsStore((state) => state.updateDetails);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const companies = useCompaniesStore((state) => state.companies);
  const contacts = useContactsStore((state) => state.contacts);

  const audience = useMemo(
    () => buildAudience(campaign.audience, companies, contacts, campaign.channel),
    [campaign.audience, campaign.channel, companies, contacts],
  );

  const readOnly = campaign.status !== "Rascunho";
  const sent = campaign.status === "Enviada";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="shrink-0">
        <div className="flex items-center gap-2 px-4 py-[14px]">
          <Button
            variant="secondary"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir navegação"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon aria-hidden className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Voltar às campanhas"
            onClick={closeEditor}
          >
            <ChevronIcon aria-hidden className="size-3 rotate-90" />
            <span aria-hidden className="hidden sm:inline">
              Campanhas
            </span>
          </Button>
          <Input
            aria-label="Nome da campanha"
            value={campaign.name}
            disabled={readOnly}
            onChange={(event) => updateDetails(campaign.id, { name: event.target.value })}
            className="h-[30px] max-w-[320px] min-w-0 flex-1 border-transparent bg-transparent px-2 font-medium disabled:opacity-100"
          />
          <Tag tone={CHANNEL_TONES[campaign.channel]} className="hidden shrink-0 sm:inline-flex">
            {CHANNEL_LABELS[campaign.channel]}
          </Tag>
          <Tag tone={STATUS_TONES[campaign.status]} className="shrink-0">
            {campaign.status}
          </Tag>
        </div>

        <Tabs value={step} onValueChange={(value) => setStep(value as EditorStep)}>
          <TabsList className="border-border overflow-x-auto border-b px-4 *:whitespace-nowrap">
            <TabsTrigger value="conteudo">1. Conteúdo</TabsTrigger>
            <TabsTrigger value="destinatarios">2. Destinatários</TabsTrigger>
            <TabsTrigger value="revisao">3. Revisão e envio</TabsTrigger>
            <TabsTrigger value="resultados" disabled={!sent} className="disabled:cursor-not-allowed disabled:opacity-40">
              4. Resultados
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {step === "conteudo" &&
          (campaign.channel === "SMS" ? (
            <SmsContentStep campaign={campaign} readOnly={readOnly} />
          ) : (
            <ContentStep campaign={campaign} readOnly={readOnly} />
          ))}
        {step === "destinatarios" && (
          <AudienceStep campaign={campaign} audience={audience} readOnly={readOnly} />
        )}
        {step === "revisao" && <ReviewStep campaign={campaign} audience={audience} />}
        {step === "resultados" && sent && <ResultsStep campaign={campaign} />}
      </ScrollArea>
    </section>
  );
}
