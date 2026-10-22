import {
  ACTION_LABELS,
  ANY_CONDITION,
  MAX_DISCOUNT_PERCENT,
  MESSAGE_ACTIONS,
  type Automation,
  type AutomationConditions,
  type AutomationStep,
  type Trigger,
} from "@/data/automations";
import type { CampaignTemplate, SmsTemplate } from "@/data/campaigns";
import type { Company } from "@/data/companies";
import { formatPercent } from "./format";

export type AutomationFilters = {
  status: string;
  search: string;
};

export const DEFAULT_AUTOMATION_FILTERS: AutomationFilters = {
  status: ANY_CONDITION,
  search: "",
};

export function filterAutomations(
  automations: Automation[],
  { status, search }: AutomationFilters,
) {
  const query = search.trim().toLowerCase();
  return automations.filter((automation) => {
    if (status !== ANY_CONDITION && automation.status !== status) return false;
    if (query && !automation.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function triggerSummary(trigger: Trigger) {
  switch (trigger.type) {
    case "dias-sem-comprar":
      return `Quando um cliente fica ${trigger.days} dias sem comprar`;
    case "divida-vencida":
      return `Quando uma dívida está vencida há ${trigger.days} dias`;
    case "fase-alterada":
      return `Quando uma oportunidade passa a “${trigger.stage}”`;
    case "campanha-aberta":
      return trigger.engagement === "Clicou"
        ? "Quando um contacto clica numa campanha"
        : "Quando um contacto abre uma campanha";
    case "cliente-criado":
      return "Quando um cliente novo é criado";
    case "cliente-muda-fase":
      return `Quando um cliente passa à fase “${trigger.clientStage}”`;
    case "oportunidade-ganha":
      return "Quando uma oportunidade é ganha";
    case "oportunidade-perdida":
      return "Quando uma oportunidade é perdida";
    case "aniversario":
      return "No aniversário do cliente";
  }
}

export function triggerUsesDays(trigger: Trigger) {
  return trigger.type === "dias-sem-comprar" || trigger.type === "divida-vencida";
}

export function conditionsSummary(conditions: AutomationConditions) {
  const parts = [
    conditions.zone !== ANY_CONDITION && `zona ${conditions.zone}`,
    conditions.segment !== ANY_CONDITION && `segmento ${conditions.segment}`,
    conditions.abc !== ANY_CONDITION && `classe ${conditions.abc}`,
  ].filter(Boolean);
  return parts.length === 0 ? "Todos os clientes" : `Só ${parts.join(", ")}`;
}

export type TemplateLists = {
  email: CampaignTemplate[];
  sms: SmsTemplate[];
};

function templateName(step: AutomationStep, templates: TemplateLists) {
  if (step.action === "enviar-email") {
    return templates.email.find((template) => template.id === step.emailTemplateId)?.name;
  }
  return templates.sms.find((template) => template.id === step.smsTemplateId)?.name;
}

export function stepSummary(step: AutomationStep, templates: TemplateLists) {
  switch (step.action) {
    case "enviar-email":
    case "enviar-sms":
      return `${ACTION_LABELS[step.action]} «${templateName(step, templates) ?? "modelo eliminado"}»`;
    case "criar-tarefa":
      return `Criar tarefa «${step.taskTitle || "sem título"}» para o gestor`;
    case "mudar-fase":
      return `Mudar a fase do cliente para «${step.stage}»`;
    case "notificar-gestor":
      return `Notificar o gestor: ${step.message || "sem mensagem"}`;
    case "adicionar-segmento":
      return `Adicionar ao segmento «${step.segmentName || "sem nome"}»`;
    case "propor-desconto":
      return `Propor ${formatPercent(step.discountPercent)} de desconto ${
        step.discountScope === "Toda a encomenda" ? "em toda a encomenda" : "nas categorias habituais"
      }, válido ${step.discountValidDays} ${step.discountValidDays === 1 ? "dia" : "dias"}`;
  }
}

export function stepDays(steps: AutomationStep[]) {
  let day = 0;
  return steps.map((step) => {
    day += Math.max(0, step.waitDays);
    return day;
  });
}

export function maxMessagesInWeek(steps: AutomationStep[]) {
  const days = stepDays(steps).filter((_, index) =>
    MESSAGE_ACTIONS.includes(steps[index].action),
  );
  return days.reduce(
    (max, start) => Math.max(max, days.filter((day) => day >= start && day < start + 7).length),
    0,
  );
}

export function automationIssues(automation: Automation) {
  const issues: string[] = [];
  if (!automation.name.trim()) issues.push("Dê um nome à automação.");
  if (triggerUsesDays(automation.trigger) && automation.trigger.days < 1) {
    issues.push("O número de dias do gatilho tem de ser pelo menos 1.");
  }
  if (automation.steps.length === 0) issues.push("Adicione pelo menos um passo.");
  automation.steps.forEach((step, index) => {
    const label = `Passo ${index + 1}`;
    if (step.action === "criar-tarefa" && !step.taskTitle.trim()) {
      issues.push(`${label}: indique o título da tarefa.`);
    }
    if (step.action === "notificar-gestor" && !step.message.trim()) {
      issues.push(`${label}: escreva a mensagem para o gestor.`);
    }
    if (step.action === "adicionar-segmento" && !step.segmentName.trim()) {
      issues.push(`${label}: indique o nome do segmento.`);
    }
    if (
      step.action === "propor-desconto" &&
      (step.discountPercent < 1 || step.discountPercent > MAX_DISCOUNT_PERCENT)
    ) {
      issues.push(`${label}: o desconto tem de estar entre 1% e ${MAX_DISCOUNT_PERCENT}%.`);
    }
    if (step.action === "propor-desconto" && step.discountValidDays < 1) {
      issues.push(`${label}: a validade tem de ser de pelo menos 1 dia.`);
    }
  });
  return issues;
}

export function matchesConditions(
  company: Company,
  conditions: AutomationConditions,
  abc: Map<string, string>,
) {
  if (conditions.zone !== ANY_CONDITION && company.zone !== conditions.zone) return false;
  if (
    conditions.segment !== ANY_CONDITION &&
    !company.tags.some((tag) => tag === conditions.segment)
  )
    return false;
  if (conditions.abc !== ANY_CONDITION && abc.get(company.id) !== conditions.abc) return false;
  return true;
}
