import type { Automation } from "@/data/automations";
import type { BlockDraft, CampaignBlock, Channel } from "@/data/campaigns";
import {
  COMPANY_EMAIL_DOMAIN,
  type CompanyProfile,
  type SenderSettings,
} from "@/data/settings";
import { normalizeAngolanPhone } from "./phone";

export function emailSender(senders: SenderSettings) {
  return `${senders.emailName} <${senders.emailAddress}>`;
}

export function emailFooter(company: CompanyProfile) {
  return `${company.tradeName} · ${company.city}, Angola`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function isCompanyEmail(value: string) {
  return isEmail(value) && value.trim().toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}

export function isValidNif(value: string) {
  return /^\d{9,14}$/.test(value.replace(/\s/g, ""));
}

export function companyProfileErrors(company: CompanyProfile) {
  const errors: Partial<Record<keyof CompanyProfile, string>> = {};
  if (!company.tradeName.trim()) errors.tradeName = "O nome comercial é obrigatório.";
  if (!company.legalName.trim()) errors.legalName = "A denominação social é obrigatória.";
  if (!isValidNif(company.nif)) errors.nif = "NIF inválido — só números, 9 a 14 dígitos.";
  if (!company.city.trim()) errors.city = "Indique a cidade.";
  if (!normalizeAngolanPhone(company.phone)) {
    errors.phone = "Telefone angolano inválido (+244 e 9 dígitos).";
  }
  if (!isEmail(company.email)) errors.email = "E-mail inválido.";
  return errors;
}

export function stripBlockIds(blocks: CampaignBlock[]): BlockDraft[] {
  return blocks.map((block) => {
    const draft: Partial<CampaignBlock> = { ...block };
    delete draft.id;
    return draft as BlockDraft;
  });
}

export function templateUsage(
  automations: Automation[],
  channel: Channel,
  templateId: string,
) {
  return automations
    .filter((automation) =>
      automation.steps.some((step) =>
        channel === "Email"
          ? step.action === "enviar-email" && step.emailTemplateId === templateId
          : step.action === "enviar-sms" && step.smsTemplateId === templateId,
      ),
    )
    .map((automation) => automation.name);
}

export function nameTaken(names: string[], candidate: string, except?: string) {
  const normalized = candidate.trim().toLowerCase();
  return names.some(
    (name) => name !== except && name.trim().toLowerCase() === normalized,
  );
}
