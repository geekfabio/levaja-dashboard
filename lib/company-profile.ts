import type { Company, CompanyProfile } from "@/data/companies";
import { isValidNif, normalizeNif } from "./nif";
import { formatAngolanPhone, normalizeAngolanPhone } from "./phone";

export type ProfileErrors = Partial<Record<keyof CompanyProfile, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function findByNif(companies: Company[], nif: string, exceptId?: string) {
  const wanted = normalizeNif(nif);
  if (!wanted) return undefined;
  return companies.find(
    (company) => company.id !== exceptId && company.profile && normalizeNif(company.profile.nif) === wanted,
  );
}

export function profileErrors(profile: CompanyProfile, companies: Company[], selfId?: string): ProfileErrors {
  const errors: ProfileErrors = {};
  if (profile.nif.trim()) {
    if (!isValidNif(profile.nif)) {
      errors.nif = "NIF inválido: 10 dígitos (empresa) ou 9 dígitos, 2 letras e 3 dígitos (pessoa singular).";
    } else {
      const other = findByNif(companies, profile.nif, selfId);
      if (other) errors.nif = `Este NIF já pertence a ${other.name}.`;
    }
  }
  if (profile.phone.trim() && !normalizeAngolanPhone(profile.phone)) {
    errors.phone = "Telefone angolano inválido: 9 dígitos a começar por 9.";
  }
  if (profile.billingEmail.trim() && !EMAIL.test(profile.billingEmail.trim())) {
    errors.billingEmail = "E-mail inválido.";
  }
  if (!Number.isFinite(profile.creditLimit) || profile.creditLimit < 0) {
    errors.creditLimit = "O limite não pode ser negativo.";
  }
  return errors;
}

export function cleanProfile(profile: CompanyProfile): CompanyProfile {
  const phone = normalizeAngolanPhone(profile.phone);
  return {
    ...profile,
    nif: normalizeNif(profile.nif),
    card: profile.card.trim().toUpperCase(),
    phone: phone ? formatAngolanPhone(phone) : profile.phone.trim(),
    billingEmail: profile.billingEmail.trim().toLowerCase(),
    address: profile.address.trim(),
    municipality: profile.municipality.trim(),
    creditLimit: Math.max(0, Math.round(profile.creditLimit)),
  };
}
