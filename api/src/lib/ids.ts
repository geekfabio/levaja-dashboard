import { createId } from "@paralleldrive/cuid2";

export function newId(prefix: string) {
  return `${prefix}_${createId()}`;
}
