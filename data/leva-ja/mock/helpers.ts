import { luandaDay } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "../repositories/common";
import type { DateRange, Page, PageQuery } from "../repositories/common";
import { RepositoryError } from "../repositories/errors";

export function paginate<T>(items: T[], query: PageQuery = {}): Page<T> {
  const pageSize = Math.max(1, Math.min(200, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function inRange(iso: string, range: DateRange) {
  if (range.from) {
    if (range.from.length === 10 ? luandaDay(iso) < range.from : iso < range.from) return false;
  }
  if (range.to) {
    if (range.to.length === 10 ? luandaDay(iso) > range.to : iso > range.to) return false;
  }
  return true;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesQuery(q: string | undefined, ...fields: (string | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = normalizeText(q);
  return fields.some((field) => field && normalizeText(field).includes(needle));
}

export function requireReason(reason: string | undefined, label = "o motivo") {
  const value = reason?.trim() ?? "";
  if (value.length < 3) {
    throw new RepositoryError("validation", `Indique ${label}.`, [{ field: "reason", message: `Indique ${label}.` }]);
  }
  return value;
}

export function findOr404<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new RepositoryError("not_found", `${label} não encontrado.`);
  return item;
}

export function byNewest<T>(pick: (item: T) => string) {
  return (a: T, b: T) => (pick(a) < pick(b) ? 1 : pick(a) > pick(b) ? -1 : 0);
}
