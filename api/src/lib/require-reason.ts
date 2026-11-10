import { apiError } from "./envelope";

export function requireReason(reason: unknown, label = "o motivo") {
  const value = typeof reason === "string" ? reason.trim() : "";
  if (value.length < 3) {
    throw apiError("validation", `Indique ${label}.`, { issues: [{ field: "reason", message: `Indique ${label}.` }] });
  }
  return value;
}
