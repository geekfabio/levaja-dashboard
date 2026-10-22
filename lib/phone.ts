export const OPERATORS = ["Unitel", "Africell", "Movicel"] as const;

export type Operator = (typeof OPERATORS)[number];

const OPERATOR_PREFIXES: Record<string, Operator> = {
  "91": "Movicel",
  "92": "Unitel",
  "93": "Unitel",
  "94": "Unitel",
  "95": "Africell",
  "96": "Africell",
  "97": "Unitel",
  "99": "Movicel",
};

export function normalizeAngolanPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00244")) digits = digits.slice(5);
  else if (digits.startsWith("244") && digits.length === 12) digits = digits.slice(3);
  if (!/^9\d{8}$/.test(digits)) return null;
  return `+244${digits}`;
}

export function operatorFor(e164: string): Operator | null {
  return OPERATOR_PREFIXES[e164.slice(4, 6)] ?? null;
}

export function formatAngolanPhone(e164: string) {
  const local = e164.slice(4);
  return `+244 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
