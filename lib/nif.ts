export function normalizeNif(input: string) {
  return input.replace(/[\s.-]/g, "").toUpperCase();
}

export function isValidNif(input: string) {
  const nif = normalizeNif(input);
  return /^\d{10}$/.test(nif) || /^\d{9}[A-Z]{2}\d{3}$/.test(nif);
}

export function nifError(input: string) {
  if (!input.trim()) return undefined;
  return isValidNif(input)
    ? undefined
    : "NIF inválido: 10 dígitos (empresa) ou 9 dígitos, 2 letras e 3 dígitos (pessoa singular).";
}
