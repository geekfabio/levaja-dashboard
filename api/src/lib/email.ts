export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain || !user) return email;
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}
