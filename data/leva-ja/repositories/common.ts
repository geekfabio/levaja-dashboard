export type PageQuery = { page?: number; pageSize?: number };

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type DateRange = { from?: string; to?: string };

export type Unsubscribe = () => void;

export type RealtimeTopic = "requests" | "providers" | "support" | "documents" | "finance" | "audit" | "all";

export type RealtimeEvent = { topic: Exclude<RealtimeTopic, "all">; at: string };

export type RealtimeListener = (event: RealtimeEvent) => void;

export const DEFAULT_PAGE_SIZE = 20;
