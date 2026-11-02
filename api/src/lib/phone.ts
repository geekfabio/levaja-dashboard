import { apiError } from "./envelope";

const AO_LOCAL = /^9\d{8}$/;
const AO_SPACED = /^\+244 9\d{2} \d{3} \d{3}$/;

export function formatAngolaPhone(raw: string): string {
  const trimmed = raw.trim();
  if (AO_SPACED.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  const local = digits.startsWith("244") ? digits.slice(3) : digits;

  if (!AO_LOCAL.test(local)) {
    throw apiError("validation", "Número de telefone inválido. Usa o formato 9XX XXX XXX.");
  }

  return `+244 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`;
}
