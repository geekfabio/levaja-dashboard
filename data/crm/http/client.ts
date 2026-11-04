import { deepCamelToSnake, deepSnakeToCamel } from "@/lib/case-convert";
import { RepositoryError } from "../repositories/errors";
import type { FieldIssue, RepositoryErrorCode } from "../repositories/errors";

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

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toRepositoryError(status: number, body: unknown) {
  const wrapper = typeof body === "object" && body !== null ? (body as { error?: unknown }) : {};
  const payload = typeof wrapper.error === "object" && wrapper.error !== null ? (wrapper.error as { message?: unknown; code?: unknown; details?: { issues?: unknown } }) : {};
  const code = (typeof payload.code === "string" && payload.code in ERROR_CODES ? payload.code : STATUS_CODES[status] ?? "network") as RepositoryErrorCode;
  const rawIssues = Array.isArray(payload.details?.issues) ? payload.details.issues : [];
  const issues = rawIssues
    .map((issue) => deepSnakeToCamel<FieldIssue>(issue))
    .filter((issue): issue is FieldIssue => typeof (issue as FieldIssue)?.field === "string" && typeof (issue as FieldIssue)?.message === "string");
  const message = typeof payload.message === "string" ? payload.message : "";
  return new RepositoryError(code, message, issues);
}

type EnvelopeMeta = { count?: number; total?: number; page?: number; page_size?: number };

function unwrapEnvelope(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    return deepSnakeToCamel(payload);
  }
  const envelope = payload as { data: unknown; meta?: EnvelopeMeta };
  const data = deepSnakeToCamel(envelope.data);
  const meta = envelope.meta;
  if (meta && typeof meta.total === "number" && typeof meta.page === "number") {
    return { items: data, total: meta.total, page: meta.page, pageSize: meta.page_size };
  }
  return data;
}

export type HttpClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string, body?: unknown) => Promise<T>;
};

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export function createHttpClient(baseUrl: string, fetchImpl: typeof fetch = fetch, getCsrfToken?: () => string | null): HttpClient {
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (MUTATING_METHODS.has(method)) {
      const csrfToken = getCsrfToken?.();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
    }
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const snakeBody = body === undefined ? undefined : deepCamelToSnake(body);
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        credentials: "include",
        body: snakeBody === undefined ? undefined : JSON.stringify(snakeBody),
      });
    } catch {
      throw new RepositoryError("network", "");
    }
    const payload = await readBody(response);
    if (!response.ok) throw toRepositoryError(response.status, payload);
    return unwrapEnvelope(payload) as T;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    del: (path, body) => request("DELETE", path, body),
  };
}
