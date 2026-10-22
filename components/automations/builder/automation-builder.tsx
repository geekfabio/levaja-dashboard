"use client";

import { useMemo, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FilterMenu from "@/components/_common/filter-menu";
import StepCard from "./step-card";
import {
  ACTION_LABELS,
  ACTION_TYPES,
  ANY_CONDITION,
  AUTOMATION_STATUS_TONES,
  CAMPAIGN_ENGAGEMENTS,
  TRIGGER_LABELS,
  TRIGGER_TYPES,
  type Automation,
  type CampaignEngagement,
  type TriggerType,
} from "@/data/automations";
import { ABC_CLASSES } from "@/data/campaigns";
import { SEGMENTS, STAGES, type Stage } from "@/data/companies";
import { OPPORTUNITY_STAGES, type OpportunityStage } from "@/data/opportunities";
import {
  automationIssues,
  conditionsSummary,
  maxMessagesInWeek,
  stepDays,
  stepSummary,
  triggerSummary,
  triggerUsesDays,
} from "@/lib/automations";
import { useAutomationsStore } from "@/stores/automations-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSalesStore } from "@/stores/sales-store";
import { useToday } from "@/hooks/use-today";
import AutomationResults from "./automation-results";
import { campaignAutomationEvents, simulateTrigger } from "@/lib/automation-engine";
import { CAMPAIGN_EVENTS } from "@/data/campaign-events";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useContactsStore } from "@/stores/contacts-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type AutomationBuilderProps = {
  automation: Automation;
};

const SEGMENT_OPTIONS = [
  { value: ANY_CONDITION, label: "Todos os segmentos" },
  ...SEGMENTS.map((segment) => ({ value: segment, label: segment })),
];
const ABC_OPTIONS = [
  { value: ANY_CONDITION, label: "Todas as classes" },
  ...ABC_CLASSES.map((abc) => ({ value: abc, label: `Classe ${abc}` })),
];

const TRIGGER_NOTES: Record<TriggerType, string> = {
  "dias-sem-comprar":
    "Conta a partir da última compra registada em Vendas. Quando o cliente volta a comprar, a sequência pára.",
  "divida-vencida":
    "Conta a partir da compra a crédito mais antiga por pagar em Vendas. Quando é paga, a sequência seguinte só começa com uma nova dívida.",
  aniversario: "Usa a data «Cliente desde» dos dados fiscais do cliente; corre uma vez por ano.",
  "cliente-criado": "Corre para cada cliente criado ou importado depois de a automação ser ativada.",
  "cliente-muda-fase":
    "Corre quando a fase do cliente muda — à mão na ficha ou pelo passo «Mudar fase do cliente» de outra automação.",
  "fase-alterada": "Corre quando uma oportunidade do cliente passa para esta fase.",
  "oportunidade-ganha": "Corre quando uma oportunidade do cliente é marcada como ganha.",
  "oportunidade-perdida": "Corre quando uma oportunidade do cliente é marcada como perdida.",
  "campanha-aberta": "Corre quando um contacto do cliente abre ou clica numa campanha de e-mail.",
}

function FlowSection({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Tag tone="blue" size="sm">
          {label}
        </Tag>
        <h2 className="eyebrow-style text-faint font-normal">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Connector() {
  return <span aria-hidden className="bg-line-strong mx-auto -my-3 h-6 w-px" />;
}

export default function AutomationBuilder({ automation }: AutomationBuilderProps) {
  const closeEditor = useAutomationsStore((state) => state.closeEditor);
  const updateName = useAutomationsStore((state) => state.updateName);
  const updateTrigger = useAutomationsStore((state) => state.updateTrigger);
  const updateConditions = useAutomationsStore((state) => state.updateConditions);
  const addStep = useAutomationsStore((state) => state.addStep);
  const updateStep = useAutomationsStore((state) => state.updateStep);
  const removeStep = useAutomationsStore((state) => state.removeStep);
  const moveStep = useAutomationsStore((state) => state.moveStep);
  const setAutomationStatus = useAutomationsStore((state) => state.setAutomationStatus);
  const removeAutomation = useAutomationsStore((state) => state.removeAutomation);
  const weeklyCap = useAutomationsStore((state) => state.weeklyCap);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const companies = useCompaniesStore((state) => state.companies);
  const sales = useSalesStore((state) => state.sales);
  const today = useToday();
  const emailTemplates = useSettingsStore((state) => state.emailTemplates);
  const smsTemplates = useSettingsStore((state) => state.smsTemplates);
  const zones = useSettingsStore((state) => state.zones);
  const zoneOptions = [
    { value: ANY_CONDITION, label: "Todas as zonas" },
    ...zones.map((zone) => ({ value: zone.name, label: zone.name })),
  ];

  const readOnly = automation.status === "Ativa";
  const { trigger, conditions, steps } = automation;
  const days = stepDays(steps);
  const issues = automationIssues(automation);
  const weeklyMessages = maxMessagesInWeek(steps);
  const recordedEvents = useAutomationRunsStore((state) => state.events);
  const contacts = useContactsStore((state) => state.contacts);
  const simulation = useMemo(
    () =>
      simulateTrigger(
        automation,
        companies,
        sales,
        [...campaignAutomationEvents(CAMPAIGN_EVENTS, contacts), ...recordedEvents],
        today,
      ),
    [automation, companies, sales, recordedEvents, contacts, today],
  );
  const entries = simulation.entries;
  const simulationTitle =
    simulation.mode === "aniversario"
      ? entries.length === 1
        ? "1 aniversário nos próximos 30 dias"
        : `${entries.length} aniversários nos próximos 30 dias`
      : simulation.mode === "acontecimento"
        ? entries.length === 1
          ? "1 acontecimento nos últimos 30 dias"
          : `${entries.length} acontecimentos nos últimos 30 dias`
        : entries.length === 1
          ? "1 cliente cumpre hoje o gatilho"
          : `${entries.length} clientes cumprem hoje o gatilho`;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border shrink-0 border-b">
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
          <Button variant="ghost" size="sm" aria-label="Voltar às automações" onClick={closeEditor}>
            <ChevronIcon aria-hidden className="size-3 rotate-90" />
            <span aria-hidden className="hidden sm:inline">
              Automações
            </span>
          </Button>
          <Input
            aria-label="Nome da automação"
            value={automation.name}
            disabled={readOnly}
            onChange={(event) => updateName(automation.id, event.target.value)}
            className="h-[30px] max-w-[320px] min-w-0 flex-1 border-transparent bg-transparent px-2 font-medium disabled:opacity-100"
          />
          <Tag tone={AUTOMATION_STATUS_TONES[automation.status]} className="shrink-0">
            {automation.status}
          </Tag>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="flex min-w-0 flex-col gap-6">
            {readOnly && (
              <div className="caption-style rounded-lg border border-line-strong bg-white/3 px-4 py-3 text-soft">
                Automação ativa — pause-a para editar. Assim nenhum contacto a meio
                da sequência recebe passos alterados.
              </div>
            )}

            <FlowSection label="Quando" title="Gatilho">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Field label="Acontecimento" htmlFor="trigger-type">
                  <Select
                    value={trigger.type}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      updateTrigger(automation.id, { type: value as TriggerType })
                    }
                  >
                    <SelectTrigger id="trigger-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {TRIGGER_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {triggerUsesDays(trigger) && (
                  <Field
                    label="Dias"
                    htmlFor="trigger-days"
                    error={trigger.days < 1 ? "Mínimo 1 dia." : undefined}
                  >
                    <Input
                      id="trigger-days"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={trigger.days}
                      disabled={readOnly}
                      className="tabular-nums"
                      onChange={(event) =>
                        updateTrigger(automation.id, { days: Number(event.target.value) || 0 })
                      }
                    />
                  </Field>
                )}
                {trigger.type === "fase-alterada" && (
                  <Field label="Nova fase" htmlFor="trigger-stage">
                    <Select
                      value={trigger.stage}
                      disabled={readOnly}
                      onValueChange={(value) =>
                        updateTrigger(automation.id, { stage: value as OpportunityStage })
                      }
                    >
                      <SelectTrigger id="trigger-stage">
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
                  </Field>
                )}
                {trigger.type === "cliente-muda-fase" && (
                  <Field label="Nova fase do cliente" htmlFor="trigger-client-stage">
                    <Select
                      value={trigger.clientStage}
                      disabled={readOnly}
                      onValueChange={(value) => updateTrigger(automation.id, { clientStage: value as Stage })}
                    >
                      <SelectTrigger id="trigger-client-stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stage}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {trigger.type === "campanha-aberta" && (
                  <Field label="Interação" htmlFor="trigger-engagement">
                    <Select
                      value={trigger.engagement}
                      disabled={readOnly}
                      onValueChange={(value) =>
                        updateTrigger(automation.id, {
                          engagement: value as CampaignEngagement,
                        })
                      }
                    >
                      <SelectTrigger id="trigger-engagement">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_ENGAGEMENTS.map((engagement) => (
                          <SelectItem key={engagement} value={engagement}>
                            {engagement === "Aberto" ? "Abriu" : "Clicou"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              <span className="caption-style text-subtle">{TRIGGER_NOTES[trigger.type]}</span>
            </FlowSection>

            <Connector />

            <FlowSection label="Se" title="Condições">
              {readOnly ? (
                <span className="lead-style">{conditionsSummary(conditions)}</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <FilterMenu
                    label="Zona"
                    value={conditions.zone}
                    options={zoneOptions}
                    onChange={(zone) => updateConditions(automation.id, { zone })}
                  />
                  <FilterMenu
                    label="Segmento"
                    value={conditions.segment}
                    options={SEGMENT_OPTIONS}
                    onChange={(segment) => updateConditions(automation.id, { segment })}
                  />
                  <FilterMenu
                    label="Classe ABC"
                    value={conditions.abc}
                    options={ABC_OPTIONS}
                    onChange={(abc) => updateConditions(automation.id, { abc })}
                  />
                </div>
              )}
              <span className="caption-style text-subtle">
                Os contactos sem consentimento no canal ficam sempre de fora dos
                passos de e-mail e SMS, como nas campanhas.
              </span>
            </FlowSection>

            <Connector />

            <FlowSection label="Então" title={`Sequência · ${steps.length} passos`}>
              <div className="flex flex-col gap-3">
                {steps.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    total={steps.length}
                    day={days[index]}
                    readOnly={readOnly}
                    onChange={(next) => updateStep(automation.id, next)}
                    onMove={(delta) => moveStep(automation.id, step.id, delta)}
                    onRemove={() => removeStep(automation.id, step.id)}
                  />
                ))}
                {steps.length === 0 && (
                  <span className="caption-style text-subtle flex h-[60px] items-center justify-center rounded-lg border border-dashed border-line-strong">
                    Sem passos. Adicione o primeiro.
                  </span>
                )}
              </div>
              {!readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="self-start">
                      <PlusIcon aria-hidden className="size-3" />
                      Adicionar passo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ACTION_TYPES.map((type) => (
                      <DropdownMenuItem key={type} onSelect={() => addStep(automation.id, type)}>
                        {ACTION_LABELS[type]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </FlowSection>
          </div>

          <div className="flex min-w-0 flex-col gap-6 self-start xl:sticky xl:top-5">
            <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
              <h2 className="eyebrow-style text-faint font-normal">Resumo</h2>
              <span className="lead-style">
                {triggerSummary(trigger)}. {conditionsSummary(conditions)}.
              </span>
              <ol className="flex flex-col gap-2">
                {steps.map((step, index) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="caption-style text-subtle w-12 shrink-0 tabular-nums">
                      Dia {days[index]}
                    </span>
                    <span className="caption-style text-soft">{stepSummary(step, { email: emailTemplates, sms: smsTemplates })}</span>
                  </li>
                ))}
              </ol>
              {weeklyMessages > weeklyCap ? (
                <span className="caption-style rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-3 py-2 text-(--tag-amber-text)">
                  Esta sequência envia até {weeklyMessages} mensagens na mesma semana. O
                  travão global ({weeklyCap} por contacto por semana) vai adiar as
                  excedentes. Espace os passos de e-mail e SMS.
                </span>
              ) : (
                <span className="caption-style text-subtle">
                  Dentro do travão global: no máximo {weeklyMessages} de {weeklyCap}{" "}
                  mensagens por contacto na mesma semana. O travão conta também as
                  campanhas e as outras automações.
                </span>
              )}
            </section>

            <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
              <h2 className="eyebrow-style text-faint font-normal">Simulação</h2>
              <span className="lead-style">{simulationTitle}</span>
              {entries.length === 0 ? (
                <span className="caption-style text-subtle">
                  {simulation.mode === "acontecimento"
                    ? "Ainda nada. Faça o acontecimento no CRM (por exemplo, criar um cliente ou mudar uma fase) e volte aqui."
                    : "Nenhum cliente nesta situação neste momento."}
                </span>
              ) : (
                <ul className="divide-border flex flex-col divide-y">
                  {entries.slice(0, 6).map(({ company, label }, index) => (
                    <li
                      key={`${company.id}-${index}`}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="caption-style text-soft truncate">{company.name}</span>
                      <span className="caption-style text-subtle shrink-0 tabular-nums">{label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {entries.length > 6 && (
                <span className="caption-style text-subtle">e mais {entries.length - 6}.</span>
              )}
              {simulation.withoutHistory > 0 && (
                <span className="caption-style text-subtle">
                  {simulation.mode === "aniversario"
                    ? `${simulation.withoutHistory} sem data «Cliente desde» ficam de fora.`
                    : simulation.withoutHistory === 1
                      ? "1 cliente sem compras registadas fica de fora."
                      : `${simulation.withoutHistory} clientes sem compras registadas ficam de fora.`}
                </span>
              )}
            </section>

            <AutomationResults automation={automation} />

            <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
              <h2 className="eyebrow-style text-faint font-normal">Estado</h2>
              {issues.length > 0 && automation.status !== "Ativa" && (
                <ul className="caption-style text-danger flex flex-col gap-1">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <span className="caption-style text-subtle">
                Ativa, corre sobre os dados do CRM a partir da data de ativação: cria propostas de desconto, tarefas e notificações e muda a fase do cliente. E-mail e SMS saem pela caixa de saída em modo sandbox — registados, nunca entregues a clientes reais.
              </span>
              <div className="flex flex-wrap gap-2">
                {automation.status === "Ativa" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAutomationStatus(automation.id, "Pausada")}
                  >
                    Pausar
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={issues.length > 0}
                    onClick={() => setAutomationStatus(automation.id, "Ativa")}
                  >
                    Ativar automação
                  </Button>
                )}
                {automation.status === "Rascunho" && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => removeAutomation(automation.id)}
                  >
                    Eliminar rascunho
                  </Button>
                )}
              </div>
            </section>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}
