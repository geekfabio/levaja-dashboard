import { create } from "zustand";
import { SYSTEM_ACTOR, type AuditChange } from "@/data/audit";
import { ACTION_LABELS, type ActionType } from "@/data/automations";
import { STAGES, type Company, type Stage } from "@/data/companies";
import { DISCOUNT_OFFERS, OPEN_OFFER_STATUSES, type DiscountOffer } from "@/data/discount-offers";
import type { Notification } from "@/data/notifications";
import type { Task } from "@/data/tasks";
import {
  buildOffer,
  daysSince,
  dueSteps,
  offerScopeLabel,
  renderTemplate,
  supersede,
  campaignAutomationEvents,
  type AutomationEvent,
  type AutomationEventType,
  type DueStep,
} from "@/lib/automation-engine";
import { CAMPAIGN_EVENTS } from "@/data/campaign-events";
import { formatDateShort, formatMoney, formatPercent, nowLuandaLocal, plural } from "@/lib/format";
import { useActivitiesStore } from "./activities-store";
import { useAuditStore } from "./audit-store";
import { useAutomationsStore } from "./automations-store";
import { useCompaniesStore } from "./companies-store";
import { useContactsStore } from "./contacts-store";
import { useMessagingStore } from "./messaging-store";
import { useNotificationsStore } from "./notifications-store";
import { useSettingsStore } from "./settings-store";
import { toast } from "./toast-store";

export const RUN_OUTCOMES = ["Feito", "Envio simulado", "Não enviado"] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const RUN_OUTCOME_TONES: Record<RunOutcome, "green" | "blue" | "amber"> = {
  Feito: "green",
  "Envio simulado": "blue",
  "Não enviado": "amber",
};

export type AutomationRun = {
  id: string;
  key: string;
  automationId: string;
  automationName: string;
  companyId: string;
  companyName: string;
  stepIndex: number;
  action: ActionType;
  dueDate: string;
  at: string;
  outcome: RunOutcome;
  detail: string;
};

type AutomationRunsState = {
  runs: AutomationRun[];
  events: AutomationEvent[];
  emit: (type: AutomationEventType, companyId: string, extra?: Pick<AutomationEvent, "stage" | "engagement">) => void;
  offers: DiscountOffer[];
  runDue: (today: string, options?: { manual?: boolean }) => number;
};

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function replaceStage(company: Company, stage: Stage) {
  const stages: readonly string[] = STAGES;
  const index = company.tags.findIndex((tag) => stages.includes(tag));
  if (index < 0) return [...company.tags, stage];
  return company.tags.map((tag, position) => (position === index ? stage : tag));
}

function currentStage(company: Company) {
  const stages: readonly string[] = STAGES;
  return company.tags.find((tag) => stages.includes(tag));
}

export const useAutomationRunsStore = create<AutomationRunsState>((set, get) => ({
  runs: [],
  events: [],
  offers: DISCOUNT_OFFERS,

  emit: (type, companyId, extra = {}) =>
    set((state) => ({
      events: [
        ...state.events,
        { id: `ev-${crypto.randomUUID().slice(0, 8)}`, type, companyId, date: nowLuandaLocal().slice(0, 10), ...extra },
      ],
    })),

  runDue: (today, options = {}) => {
    const { automations, weeklyCap } = useAutomationsStore.getState();
    const companies = useCompaniesStore.getState().companies;
    const contacts = useContactsStore.getState().contacts;
    const { emailTemplates, smsTemplates } = useSettingsStore.getState();
    const campaignEvents = campaignAutomationEvents(CAMPAIGN_EVENTS, contacts);
    const due = dueSteps({
      automations,
      companies,
      events: [...campaignEvents, ...get().events],
      today,
      done: new Set(get().runs.map((run) => run.key)),
    });

    if (due.length === 0) {
      if (options.manual) {
        toast({ title: "Automações em dia", description: "Não há passos por executar hoje." });
      }
      return 0;
    }

    const at = nowLuandaLocal();
    const runs: AutomationRun[] = [];
    const tasks: Task[] = [];
    const notifications: Notification[] = [];
    const stageChanges = new Map<string, Stage>();
    let offers = get().offers;
    const previous = get().runs;

    const messagesThisWeek = (companyId: string) =>
      [...previous, ...runs].filter(
        (run) => run.companyId === companyId && run.outcome === "Envio simulado" && daysSince(run.at, today) < 7,
      ).length;

    function execute(item: DueStep): { outcome: RunOutcome; detail: string } {
      const { company, step, automation } = item;
      switch (step.action) {
        case "propor-desconto": {
          offers = supersede(offers, company.id);
          const offer = buildOffer(
            company,
            step.discountPercent,
            step.discountScope,
            step.discountValidDays,
            today,
            `Automação «${automation.name}»`,
            { automationId: automation.id },
          );
          offers = [offer, ...offers];
          return {
            outcome: "Feito",
            detail: `Proposta de ${formatPercent(offer.percent)} ${offerScopeLabel(offer)}, válida até ${formatDateShort(offer.validUntil)}, para ${company.owner} apresentar.`,
          };
        }
        case "enviar-email":
        case "enviar-sms": {
          const channel = step.action === "enviar-sms" ? "sms" : "email";
          const contact = contacts.find(
            (entry) =>
              entry.companyId === company.id &&
              entry.contactability === "Válido" &&
              entry.consent[channel].granted,
          );
          if (!contact) {
            return {
              outcome: "Não enviado",
              detail: `Nenhum contacto com consentimento de ${channel === "sms" ? "SMS" : "e-mail"}.`,
            };
          }
          const sent = messagesThisWeek(company.id);
          if (sent >= weeklyCap) {
            return {
              outcome: "Não enviado",
              detail: `Travão semanal: já recebeu ${plural(sent, "mensagem", "mensagens")} esta semana.`,
            };
          }
          if (channel === "email") {
            const template = emailTemplates.find((entry) => entry.id === step.emailTemplateId);
            const record = useMessagingStore.getState().send({
              channel: "E-mail",
              to: contact.email,
              toName: contact.name,
              subject: template?.name ?? "Modelo eliminado",
              body: template?.description ?? "",
              companyId: company.id,
              contactId: contact.id,
              source: `Automação «${automation.name}»`,
            });
            return record.status === "Bloqueado"
              ? { outcome: "Não enviado", detail: record.reason ?? "Bloqueado pelo fornecedor." }
              : {
                  outcome: "Envio simulado",
                  detail: `E-mail «${template?.name ?? "modelo eliminado"}» para ${contact.email}. Modo sandbox — reencaminhado para ${record.deliveredTo}.`,
                };
          }
          const template = smsTemplates.find((entry) => entry.id === step.smsTemplateId);
          const offer = offers.find((entry) => entry.companyId === company.id && OPEN_OFFER_STATUSES.includes(entry.status));
          const text = renderTemplate(template?.body ?? "", {
            nome: company.name,
            zona: company.zone,
            desconto: offer ? formatPercent(offer.percent) : "um desconto",
            validade: offer ? formatDateShort(offer.validUntil) : "ao fim do mês",
          });
          const record = useMessagingStore.getState().send({
            channel: "SMS",
            to: contact.phone,
            toName: contact.name,
            body: text,
            companyId: company.id,
            contactId: contact.id,
            source: `Automação «${automation.name}»`,
          });
          return record.status === "Bloqueado"
            ? { outcome: "Não enviado", detail: record.reason ?? "Bloqueado pelo fornecedor." }
            : {
                outcome: "Envio simulado",
                detail: `SMS para ${contact.name} (${contact.phone}): “${text}” ${formatMoney(record.cost)} · modo sandbox — reencaminhado para ${record.deliveredTo}.`,
              };
        }
        case "criar-tarefa": {
          tasks.push({
            id: newId("task"),
            title: step.taskTitle,
            companyId: company.id,
            companyName: company.name,
            assignee: company.owner,
            dueDate: today,
            status: "Por Fazer",
            notes: `Criada pela automação «${automation.name}».`,
          });
          return { outcome: "Feito", detail: `Tarefa «${step.taskTitle}» para ${company.owner}.` };
        }
        case "mudar-fase": {
          const from = currentStage(company);
          stageChanges.set(company.id, step.stage);
          return { outcome: "Feito", detail: `Fase do cliente: ${from ?? "sem fase"} → ${step.stage}.` };
        }
        case "notificar-gestor": {
          notifications.push({
            id: newId("n"),
            kind: "alert",
            companyId: company.id,
            message: `${company.name}: ${step.message}`,
            at,
            target: { module: "Clientes", id: company.id, label: company.name },
            unread: true,
          });
          return { outcome: "Feito", detail: `${company.owner} notificado: ${step.message}` };
        }
        case "adicionar-segmento":
          return { outcome: "Feito", detail: `Marcado para o segmento «${step.segmentName}».` };
      }
    }

    for (const item of due) {
      const { outcome, detail } = execute(item);
      runs.push({
        id: newId("run"),
        key: item.key,
        automationId: item.automation.id,
        automationName: item.automation.name,
        companyId: item.company.id,
        companyName: item.company.name,
        stepIndex: item.stepIndex,
        action: item.step.action,
        dueDate: item.dueDate,
        at,
        outcome,
        detail,
      });
    }

    set({ runs: [...runs.reverse(), ...previous], offers });

    if (tasks.length > 0) {
      useActivitiesStore.setState((state) => ({ tasks: [...tasks, ...state.tasks] }));
    }
    if (stageChanges.size > 0) {
      const before = new Map(useCompaniesStore.getState().companies.map((company) => [company.id, currentStage(company)]));
      useCompaniesStore.setState((state) => ({
        companies: state.companies.map((company) => {
          const stage = stageChanges.get(company.id);
          return stage ? { ...company, tags: replaceStage(company, stage) } : company;
        }),
      }));
      for (const [companyId, stage] of stageChanges) {
        if (before.get(companyId) !== stage) get().emit("cliente-muda-fase", companyId, { stage });
      }
    }

    const audit = useAuditStore.getState();
    for (const run of runs) {
      const changes: AuditChange[] = [
        { field: "Passo", to: `${run.stepIndex + 1} · ${ACTION_LABELS[run.action]}` },
        { field: "Resultado", to: run.outcome },
      ];
      audit.append({
        id: `au-${run.id}`,
        at,
        actor: SYSTEM_ACTOR,
        action: `executou «${run.automationName}» em`,
        target: { module: "Clientes", id: run.companyId, label: run.companyName },
        changes,
        sensitive: run.action === "enviar-email" || run.action === "enviar-sms",
      });
    }

    const counts = new Map<string, { enrolled: number; completed: number }>();
    for (const item of due) {
      const entry = counts.get(item.automation.id) ?? { enrolled: 0, completed: 0 };
      if (item.firstStep) entry.enrolled += 1;
      if (item.lastStep) entry.completed += 1;
      counts.set(item.automation.id, entry);
    }
    useAutomationsStore.setState((state) => ({
      automations: state.automations.map((automation) => {
        const entry = counts.get(automation.id);
        return entry
          ? {
              ...automation,
              lastRunAt: at,
              enrolled: automation.enrolled + entry.enrolled,
              completed: automation.completed + entry.completed,
            }
          : automation;
      }),
    }));

    const newOffers = runs.filter((run) => run.action === "propor-desconto").length;
    const summary = [
      newOffers > 0 && plural(newOffers, "proposta de desconto", "propostas de desconto"),
      tasks.length > 0 && plural(tasks.length, "tarefa", "tarefas"),
      runs.filter((run) => run.outcome === "Envio simulado").length > 0 &&
        plural(runs.filter((run) => run.outcome === "Envio simulado").length, "envio simulado", "envios simulados"),
      runs.filter((run) => run.outcome === "Não enviado").length > 0 &&
        plural(runs.filter((run) => run.outcome === "Não enviado").length, "mensagem retida", "mensagens retidas"),
    ]
      .filter(Boolean)
      .join(", ");

    const inbox = useNotificationsStore.getState();
    for (const notification of notifications) inbox.push(notification);
    inbox.push({
      id: newId("n"),
      kind: "update",
      message: `As automações executaram ${plural(runs.length, "passo", "passos")}${summary ? `: ${summary}` : ""}.`,
      at,
      href: "/automacoes",
      unread: true,
    });

    if (options.manual) {
      toast({
        title: `${plural(runs.length, "passo executado", "passos executados")}`,
        description: summary,
        tone: "success",
      });
    }
    return runs.length;
  },
}));
