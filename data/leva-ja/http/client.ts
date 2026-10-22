import { RepositoryError } from "../repositories/errors";
import type { FieldIssue, RepositoryErrorCode } from "../repositories/errors";

export type QueryValue = string | number | boolean | undefined | null | readonly (string | number)[];

export type HttpClientOptions = {
  baseUrl: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
};

type RequestOptions = { query?: Record<string, QueryValue>; body?: unknown };

const STATUS_CODES: Record<number, RepositoryErrorCode> = {
  400: "validation",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "invalid_transition",
  422: "validation",
};

const ERROR_CODES: Record<RepositoryErrorCode, true> = {
  network: true,
  not_found: true,
  invalid_transition: true,
  forbidden: true,
  validation: true,
  unauthorized: true,
};

export function buildQuery(query: Record<string, QueryValue> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function toRepositoryError(status: number, body: unknown) {
  const payload = typeof body === "object" && body !== null ? (body as { message?: unknown; code?: unknown; issues?: unknown }) : {};
  const code = (typeof payload.code === "string" && payload.code in ERROR_CODES ? payload.code : STATUS_CODES[status] ?? "network") as RepositoryErrorCode;
  const issues = Array.isArray(payload.issues)
    ? payload.issues.filter((issue): issue is FieldIssue => typeof issue?.field === "string" && typeof issue?.message === "string")
    : [];
  const message = typeof payload.message === "string" ? payload.message : "";
  return new RepositoryError(code, message, issues);
}

export type HttpClient = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string, body?: unknown) => Promise<T>;
};

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const run = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const base = options.baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, { query, body }: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await run(`${base}${path}${buildQuery(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new RepositoryError("network", "");
    }
    const payload = await readBody(response);
    if (!response.ok) {
      const error = toRepositoryError(response.status, payload);
      if (error.code === "unauthorized") options.onUnauthorized?.();
      throw error;
    }
    return payload as T;
  }

  return {
    get: (path, query) => request("GET", path, { query }),
    post: (path, body) => request("POST", path, { body }),
    put: (path, body) => request("PUT", path, { body }),
    del: (path, body) => request("DELETE", path, { body }),
  };
}

export function polling(intervalMs: number) {
  return (topic: "requests" | "providers" | "support", listener: (event: { topic: typeof topic; at: string }) => void) => {
    const timer = setInterval(() => listener({ topic, at: new Date().toISOString() }), intervalMs);
    return () => clearInterval(timer);
  };
}
