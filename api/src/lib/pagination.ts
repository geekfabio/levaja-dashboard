import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  page_size: z.coerce.number().int().positive().optional(),
});

export type PageQuery = { page?: number; page_size?: number };

export function paginate<T>(items: T[], query: PageQuery = {}) {
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, query.page_size ?? DEFAULT_PAGE_SIZE));
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  };
}

export function listPageEnvelope<T>(page: ReturnType<typeof paginate<T>>) {
  return {
    data: page.items,
    meta: { count: page.items.length, total: page.total, page: page.page, page_size: page.page_size },
  };
}

export function csvList(value: string | undefined) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}
